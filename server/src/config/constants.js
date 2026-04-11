'use strict';

module.exports = {
  // Order Statuses
  ORDER_STATUS: {
    PENDING_PAYMENT: 'pending_payment',
    PAID: 'paid',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded',
  },

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
