'use strict';

const { Op } = require('sequelize');
const { Enquiry, Product, ProductVariant, VariantOption, AttributeTemplate, AttributeValue, User, sequelize } = require('../index');
const notificationService = require('../notification/notification.service');
const settingsService = require('../settings/settings.service');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

const parseRecipientList = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const extractEmailAddress = (value) => {
  const input = String(value || '').trim();
  if (!input) return null;
  const match = input.match(/<([^>]+)>/);
  return (match ? match[1] : input).trim();
};

const uniqueEmails = (values) => {
  const seen = new Set();
  return values
    .map(extractEmailAddress)
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || ''))
    .filter((email) => {
      const key = email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

class EnquiryService {
  async resolveProductSelection(productId, variantId = null) {
    const product = productId ? await Product.findByPk(productId) : null;
    if (!product || product.status !== 'published' || product.isEnabled === false) {
      throw new AppError('NOT_FOUND', 404, 'Product not found or unavailable. Please update your enquiry list.');
    }
    let variant = null;
    if (variantId) {
      variant = await ProductVariant.findOne({
        where: { id: variantId, productId, isActive: true },
        include: [{ model: VariantOption, as: 'options', include: [
          { model: AttributeTemplate, as: 'attribute', paranoid: false },
          { model: AttributeValue, as: 'value' },
        ] }],
      });
      if (!variant) throw new AppError('VALIDATION_ERROR', 400, 'Selected variant is unavailable or does not belong to this product.');
    } else if (product.type === 'variable' || await ProductVariant.count({ where: { productId, isActive: true } }) > 0) {
      throw new AppError('VALIDATION_ERROR', 400, `Please choose an option for ${product.name}.`);
    }
    const optionLabel = (variant?.options || [])
      .slice().sort((a, b) => (a.attribute?.sortOrder || 0) - (b.attribute?.sortOrder || 0))
      .map((option) => {
        let value = String(option.value?.displayLabel || option.value?.value || '');
        const unit = String(option.value?.unitLabel || option.attribute?.unit || '').trim();
        if (unit && !value.toLowerCase().endsWith(unit.toLowerCase())) value += (/^(g|kg|mg|mm|cm|m|in|ft|ml|l)$/i.test(unit) ? '' : ' ') + unit;
        return option.attribute?.name && value ? `${option.attribute.name}: ${value}` : '';
      }).filter(Boolean).join(', ');
    return { product, variant, optionLabel };
  }

  async normalizeCartItems(cartItems = []) {
    if (!Array.isArray(cartItems) || cartItems.length === 0) return null;

    const normalized = [];
    for (const item of cartItems) {
      const quantity = Number(item?.quantity);
      if (!Number.isSafeInteger(quantity) || quantity < 1) throw new AppError('VALIDATION_ERROR', 400, 'Quantity must be a positive whole number.');
      const productId = item?.productId || (typeof item?.product === 'string' ? item.product : item?.product?.id) || null;
      const variantId = item?.variantId || item?.variant?.id || null;
      const { product, variant, optionLabel } = await this.resolveProductSelection(productId, variantId);

      normalized.push({
        product: {
          id: productId,
          name: product.name,
          sku: product.sku || null,
        },
        variant: variantId ? {
          id: variantId,
          sku: variant.sku || null,
          optionLabel,
        } : null,
        quantity,
      });
    }

    return normalized;
  }

  async getAdminNotificationEmails(settings) {
    const recipientsService = require('../notification/notificationRecipients.service');
    const configured = await recipientsService.getConfiguredRecipients('new_enquiry_admin');
    if (configured !== null) return uniqueEmails(configured.map((user) => user.email));
    const eligible = await recipientsService.getEligibleRecipientsForTemplate('new_enquiry_admin');

    return uniqueEmails([
      ...parseRecipientList(process.env.ADMIN_NOTIFICATION_EMAIL),
      settings?.general?.storeEmail,
      ...eligible.map((user) => user.email),
    ]);
  }

  /**
   * Create a new enquiry
   */
  async createEnquiry(data, userId = null) {
    const name = data.name?.trim();
    const email = data.email?.trim();
    const message = data.message?.trim();

    // Basic validation
    if (!name || !email || !message) {
      throw new AppError('VALIDATION_ERROR', 400, 'Name, email, and message are required.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid email format.');
    }

    let parsedQuantity = Number(data.quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      parsedQuantity = 1;
    }

    const selection = data.productId ? await this.resolveProductSelection(data.productId, data.variantId) : null;
    const normalizedCartItems = await this.normalizeCartItems(data.cartItems);
    if (!selection && !normalizedCartItems) throw new AppError('VALIDATION_ERROR', 400, 'Choose a product or add items to your enquiry list.');

    const payload = {
      name,
      email,
      phone: data.phone?.trim() || null,
      message,
      quantity: parsedQuantity,
      productId: data.productId || null,
      variantId: data.variantId || null,
      cartItems: normalizedCartItems,
      status: 'pending',
    };

    const enquiry = await Enquiry.create(payload);

    // Notification failures must not turn a saved enquiry into a failed submission.
    try {
      // Fetch store settings for admin email
      const settings = await settingsService.getAll();
      const storeName = settings?.general?.storeName || 'Our Store';

      // Fetch product details for email context if it's a product enquiry
      const productDetails = selection ? {
        name: selection.product.name + (selection.optionLabel ? ` (${selection.optionLabel})` : ''),
        sku: selection.variant?.sku || selection.product.sku,
      } : null;

      // Prepare variables for email
      const templateVars = {
        enquiryId: enquiry.id,
        enquiry_id: enquiry.id,
        customerName: enquiry.name,
        customerEmail: enquiry.email,
        customerPhone: enquiry.phone || 'N/A',
        message: enquiry.message,
        quantity: enquiry.quantity,
        storeName,
        productName: productDetails ? productDetails.name : (enquiry.cartItems ? 'Cart Items' : 'General Enquiry'),
        productSku: productDetails ? productDetails.sku : '',
        cartItems: enquiry.cartItems?.map((item) => ({
          ...item,
          product: { ...item.product, name: item.product.name + (item.variant?.optionLabel ? ` (${item.variant.optionLabel})` : '') },
        })),
      };

      const routed = await notificationService.sendEvent('enquiry_received', { variables: templateVars });
      if (routed !== null) return enquiry;

      // 1. Alert Admin
      const adminEmails = await this.getAdminNotificationEmails(settings);
      const adminResults = [];
      for (const adminEmail of adminEmails) {
        adminResults.push(await notificationService.send(
          'new_enquiry_admin',
          adminEmail,
          templateVars,
          userId,
          null,
          'email'
        ));
      }

      // 2. Auto-reply Customer
      const customerQueued = settings?.messaging?.enquiryCustomerAcknowledgementEnabled !== false
        && settings?.messaging?.enquiryCustomerAcknowledgementEnabled !== 'false'
        ? await notificationService.send(
          'new_enquiry_customer',
          enquiry.email,
          templateVars,
          userId,
          null,
          'email'
        ) : false;

      if (!adminResults.some(Boolean) && !customerQueued) {
        logger.warn('[EnquiryService] Enquiry saved but no email notifications were queued', {
          enquiryId: enquiry.id,
          adminRecipientCount: adminEmails.length,
        });
      }
    } catch (err) {
      logger.error('[EnquiryService] Failed to send email notifications:', { 
        error: err.message, 
        stack: err.stack, 
        enquiryId: enquiry.id 
      });
    }

    return enquiry;
  }

  /**
   * Get paginated enquiries
   */
  async getEnquiries(filters = {}, pagination = { page: 1, limit: 20 }) {
    const where = {};
    if (filters.status) where.status = filters.status;

    const limit = parseInt(pagination.limit) || 20;
    const offset = (parseInt(pagination.page || 1) - 1) * limit;
    const sortMap = {
      createdAt: ['created_at', filters.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'],
      name: ['name', filters.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'],
      email: ['email', filters.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'],
      status: ['status', filters.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'],
    };

    if (filters.search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${filters.search}%` } },
        { email: { [Op.iLike]: `%${filters.search}%` } },
        { phone: { [Op.iLike]: `%${filters.search}%` } },
        { message: { [Op.iLike]: `%${filters.search}%` } },
      ];
    }

    const include = [
      { model: Product, as: 'product', attributes: ['id', 'name', 'slug'], required: false },
      { model: ProductVariant, as: 'variant', attributes: ['id', 'sku'], required: false, include: [
        { model: VariantOption, as: 'options', separate: true, include: [
          { model: AttributeTemplate, as: 'attribute', paranoid: false },
          { model: AttributeValue, as: 'value' },
        ] },
      ] },
    ];

    if (filters.search) {
      include[0].where = {
        [Op.or]: [
          { name: { [Op.iLike]: `%${filters.search}%` } },
        ],
      };
      include[0].required = false;
      where[Op.or].push({ '$product.name$': { [Op.iLike]: `%${filters.search}%` } });
    }

    const normalizedSortBy = filters.sortBy === 'subject' ? 'createdAt' : (filters.sortBy || 'createdAt');
    const order = [sortMap[normalizedSortBy] || sortMap.createdAt];

    const { count, rows } = await Enquiry.findAndCountAll({
      where,
      limit,
      offset,
      order,
      include,
      distinct: true,
    });

    return {
      data: rows,
      meta: {
        total: count,
        page: parseInt(pagination.page || 1),
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Update enquiry status
   */
  async updateStatus(id, status) {
    const validStatuses = ['pending', 'responded', 'closed'];
    if (!validStatuses.includes(status)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid status');
    }

    const enquiry = await Enquiry.findByPk(id);
    if (!enquiry) {
      throw new AppError('NOT_FOUND', 404, 'Enquiry not found');
    }

    enquiry.status = status;
    await enquiry.save();

    return enquiry;
  }

  /**
   * Reply to an enquiry via email and update its status
   */
  async replyToEnquiry(id, replyMessage, adminUserId = null) {
    if (!replyMessage || !replyMessage.trim()) {
      throw new AppError('VALIDATION_ERROR', 400, 'Reply message cannot be empty');
    }

    const enquiry = await Enquiry.findByPk(id, {
      include: [
        { model: Product, as: 'product' }
      ]
    });

    if (!enquiry) {
      throw new AppError('NOT_FOUND', 404, 'Enquiry not found');
    }

    const settings = await settingsService.getAll();
    const storeName = settings?.general?.storeName || 'Our Store';

    const templateVars = {
      enquiry_id: enquiry.id,
      notification_event_id: require('crypto').randomUUID(),
      customerName: enquiry.name,
      message: enquiry.message,
      replyMessage: replyMessage.trim(),
      productName: enquiry.product ? enquiry.product.name : (enquiry.cartItems ? 'Cart Items' : 'General Enquiry'),
      storeName
    };

    const transaction = await sequelize.transaction();

    try {
      if (enquiry.status === 'pending') {
        enquiry.status = 'responded';
        await enquiry.save({ transaction });
      }

      const routed = await notificationService.sendEvent('enquiry_replied', { variables: templateVars, transaction });
      const queued = routed === null ? await notificationService.send(
        'enquiry_reply_customer',
        enquiry.email,
        templateVars,
        adminUserId,
        null,
        'email',
        transaction
      ) : routed.length === 0 || routed.some(Boolean);

      if (!queued) {
        throw new Error('Reply email could not be queued');
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      console.error('[EnquiryService] Failed to send reply email and update status:', err);
      throw new AppError('INTERNAL_SERVER_ERROR', 500, 'Failed to send reply email');
    }

    return enquiry;
  }
}

module.exports = new EnquiryService();
