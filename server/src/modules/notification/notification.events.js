'use strict';

const { TEMPLATE_VARIABLES } = require('./notification.defaults');

const definitions = [
  ['order_placed', 'Order placed', 'Orders', 'Customers receive confirmation after online payment or when a cash-on-delivery order is created. Internal alerts are sent when the order is created.', 'order_placed', 'admin_new_order'],
  ['order_shipped', 'Order shipped', 'Orders', 'When a shipment is created.', 'order_shipped'],
  ['order_out_for_delivery', 'Out for delivery', 'Orders', 'When an order is out for delivery.', 'order_out_for_delivery'],
  ['order_delivered', 'Order delivered', 'Orders', 'When delivery is confirmed.', 'order_delivered'],
  ['delivery_exception', 'Delivery needs attention', 'Orders', 'When delivery fails or a shipment is returned to sender.', 'delivery_exception'],
  ['order_cancelled', 'Order cancelled', 'Orders', 'When an order is cancelled.', 'order_cancelled', 'admin_order_cancelled'],
  ['order_refunded', 'Order refunded', 'Payments', 'When a refund is processed.', 'order_refunded'],
  ['payment_failed', 'Payment failed', 'Payments', 'When payment fails.', 'payment_failed_customer', 'admin_order_failed'],
  ['return_requested', 'Return or replacement requested', 'Returns', 'When a customer requests a return or replacement.', 'return_requested', 'admin_return_requested'],
  ['return_status_updated', 'Return or replacement updated', 'Returns', 'When the request status changes.', 'return_status_updated'],
  ['enquiry_received', 'Enquiry received', 'Enquiries', 'When a customer submits an enquiry.', 'new_enquiry_customer', 'new_enquiry_admin'],
  ['enquiry_closed_converted', 'Enquiry closed – Converted', 'Enquiries', 'When an enquiry is closed with a converted outcome.', 'enquiry_closed_converted_customer'],
  ['enquiry_closed_lost', 'Enquiry closed – Lost', 'Enquiries', 'When an enquiry is closed with a lost outcome.', 'enquiry_closed_lost_customer'],
  ['enquiry_replied', 'Enquiry replied to', 'Enquiries', 'When staff send a reply to an enquiry.', 'enquiry_reply_customer'],
];

const EVENTS = definitions.map(([key, label, group, description, customerTemplate, internalTemplate]) => ({
  key, label, group, description, customerTemplate, internalTemplate,
  defaultChannels: ['order_placed', 'order_shipped', 'order_cancelled'].includes(key) ? ['email', 'sms', 'whatsapp']
    : ['order_out_for_delivery', 'order_delivered'].includes(key) ? ['email', 'sms'] : ['email'],
  variables: [...new Set([
    ...(TEMPLATE_VARIABLES[customerTemplate] || []), ...(TEMPLATE_VARIABLES[internalTemplate] || []),
    'recipient_name', 'customer_name', 'customer_email', 'customer_phone', 'order_id', 'enquiry_id',
  ])],
}));
const findEvent = (key) => EVENTS.find(event => event.key === key);
const eventForTemplate = (name) => EVENTS.find(event => event.customerTemplate === name || event.internalTemplate === name);

module.exports = { EVENTS, findEvent, eventForTemplate };
