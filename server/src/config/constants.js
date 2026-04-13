'use strict';

const { ORDER_STATUS_VALUES } = require('../utils/orderWorkflow');

const toConstantKey = (value) => String(value || '').toUpperCase();

module.exports = {
  // Order Statuses
  ORDER_STATUS: Object.freeze(
    ORDER_STATUS_VALUES.reduce((accumulator, value) => {
      accumulator[toConstantKey(value)] = value;
      return accumulator;
    }, {})
  ),

  // Payment Statuses
  PAYMENT_STATUS: {
    PENDING: 'pending',
    SUCCESS: 'success',
    FAILED: 'failed',
    REFUNDED: 'refunded',
  },

  // User Roles
  ROLES: {
    CUSTOMER: 'customer',
    ADMIN: 'admin',
    SUPER_ADMIN: 'super_admin',
  },

  // Entity Types for Audit Logs
  ENTITIES: {
    PRODUCT: 'Product',
    ORDER: 'Order',
    USER: 'User',
    ADDRESS: 'Address',
    PAYMENT: 'Payment',
    CATEGORY: 'Category',
    COUPON: 'Coupon',
    REVIEW: 'Review',
    SETTING: 'Setting',
    PAGE: 'Page',
  },

  // Actions for Audit Logs
  ACTIONS: {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    REFRESH: 'REFRESH',
    PASSWORD_RESET: 'PASSWORD_RESET',
    EMAIL_VERIFIED: 'EMAIL_VERIFIED',
    VERIFICATION_RESENT: 'VERIFICATION_RESENT',
    STATUS_CHANGE: 'STATUS_CHANGE',
  },

  AUTH_TIME: Object.freeze({
    REFRESH_TOKEN_TTL_MS: 7 * 24 * 60 * 60 * 1000,
    EMAIL_VERIFICATION_TTL_MS: 24 * 60 * 60 * 1000,
    PASSWORD_RESET_TTL_MS: 15 * 60 * 1000,
  }),
};
