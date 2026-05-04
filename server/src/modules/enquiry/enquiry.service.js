'use strict';

const { Enquiry, Product, ProductVariant, sequelize } = require('../index');
const notificationService = require('../notification/notification.service');
const settingsService = require('../settings/settings.service');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

class EnquiryService {
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

    const payload = {
      name,
      email,
      phone: data.phone?.trim() || null,
      message,
      quantity: parsedQuantity,
      productId: data.productId || null,
      variantId: data.variantId || null,
      cartItems: data.cartItems || null,
      status: 'pending',
    };

    const enquiry = await Enquiry.create(payload);

    // Fetch store settings for admin email
    const settings = await settingsService.getAll();
    const adminEmail = settings?.general?.storeEmail || 'admin@store.com';
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
      await notificationService.send(
        'new_enquiry_admin',
        adminEmail,
        templateVars,
        userId,
        enquiry.id,
        'email'
      );

      // 2. Auto-reply Customer
      await notificationService.send(
        'new_enquiry_customer',
        enquiry.email,
        templateVars,
        userId,
        enquiry.id,
        'email'
      );
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

    const { count, rows } = await Enquiry.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        { model: Product, as: 'product', attributes: ['id', 'name', 'slug'] },
        { model: ProductVariant, as: 'variant', attributes: ['id', 'sku'] },
      ],
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

      await notificationService.send(
        'enquiry_reply_customer',
        enquiry.email,
        templateVars,
        adminUserId,
        enquiry.id,
        'email'
      );

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
