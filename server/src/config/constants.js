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
    STATUS_CHANGE: 'STATUS_CHANGE',
  },
};
