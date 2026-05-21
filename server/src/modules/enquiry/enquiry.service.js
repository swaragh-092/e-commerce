'use strict';

const { Op } = require('sequelize');
const { Enquiry, Product, ProductVariant, User, sequelize } = require('../index');
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
  async normalizeCartItems(cartItems = []) {
    if (!Array.isArray(cartItems) || cartItems.length === 0) return null;

    const normalized = [];
    for (const item of cartItems) {
      const quantity = Number(item?.quantity) > 0 ? Number(item.quantity) : 1;
      const productId = item?.product?.id || null;
      const variantId = item?.variant?.id || null;

      let product = null;
      if (productId) {
        product = await Product.findByPk(productId, {
          attributes: ['id', 'name', 'sku'],
        });
      }

      let variant = null;
      if (variantId) {
        variant = await ProductVariant.findByPk(variantId, {
          attributes: ['id', 'sku'],
        });
      }

      normalized.push({
        product: {
          id: productId,
          name: item?.product?.name || product?.name || 'Unknown Product',
          sku: item?.product?.sku || product?.sku || null,
        },
        variant: variantId ? {
          id: variantId,
          sku: item?.variant?.sku || variant?.sku || null,
        } : null,
        quantity,
      });
    }

    return normalized;
  }

  async getAdminNotificationEmails(settings) {
    const adminUsers = await User.findAll({
      where: {
        role: { [Op.in]: ['admin', 'super_admin'] },
        status: 'active',
      },
      attributes: ['email'],
    });

    return uniqueEmails([
      ...parseRecipientList(process.env.ADMIN_NOTIFICATION_EMAIL),
      settings?.general?.storeEmail,
      ...adminUsers.map((user) => user.email),
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

    const normalizedCartItems = await this.normalizeCartItems(data.cartItems);

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

    // Fetch store settings for admin email
    const settings = await settingsService.getAll();
    const adminEmails = await this.getAdminNotificationEmails(settings);
    const storeName = settings?.general?.storeName || 'Our Store';

    // Fetch product details for email context if it's a product enquiry
    let productDetails = null;
    if (enquiry.productId) {
      const p = await Product.findByPk(enquiry.productId, {
        include: enquiry.variantId ? [{ model: ProductVariant, as: 'variants', where: { id: enquiry.variantId } }] : [],
      });
      if (p) {
        productDetails = {
          name: p.name,
          sku: enquiry.variantId && p.variants.length > 0 ? p.variants[0].sku : p.sku,
        };
      }
    }

    // Prepare variables for email
    const templateVars = {
      enquiryId: enquiry.id,
      customerName: enquiry.name,
      customerEmail: enquiry.email,
      customerPhone: enquiry.phone || 'N/A',
      message: enquiry.message,
      quantity: enquiry.quantity,
      storeName,
      productName: productDetails ? productDetails.name : (enquiry.cartItems ? 'Cart Items' : 'General Enquiry'),
      productSku: productDetails ? productDetails.sku : '',
      cartItems: enquiry.cartItems,
    };

    // Dispatch async notifications
    try {
      // 1. Alert Admin
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
      const customerQueued = await notificationService.send(
        'new_enquiry_customer',
        enquiry.email,
        templateVars,
        userId,
        null,
        'email'
      );

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
      { model: ProductVariant, as: 'variant', attributes: ['id', 'sku'], required: false },
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

      const queued = await notificationService.send(
        'enquiry_reply_customer',
        enquiry.email,
        templateVars,
        adminUserId,
        null,
        'email',
        transaction
      );

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
