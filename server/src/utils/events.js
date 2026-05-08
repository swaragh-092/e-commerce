'use strict';
const EventEmitter = require('events');

/**
 * Global Event Emitter for Pub/Sub integrations.
 * Use this to publish events when important entity changes occur.
 */
class GlobalEmitter extends EventEmitter {}

const events = new GlobalEmitter();
events.setMaxListeners(20);
events.on('error', (err) => {
  console.error('GlobalEmitter Error:', err);
});

// Event Names Constants
const PRODUCT_EVENTS = {
  CREATED: 'product.created',
  UPDATED: 'product.updated',
  DELETED: 'product.deleted',
  BULK_UPDATED: 'product.bulk_updated',
  BULK_DELETED: 'product.bulk_deleted',
  STOCK_CHANGED: 'product.stock_changed',
};

const ORDER_EVENTS = {
  PLACED: 'order.placed',
  STATUS_CHANGED: 'order.status_changed',
  PAYMENT_RECEIVED: 'order.payment_received',
};

module.exports = {
  events,
  PRODUCT_EVENTS,
  ORDER_EVENTS,
};
