// Use resolved capabilities: changing store mode changes these flags, while
// hiding a Tier 1 interface does not stop its notifications from being sent.
const TEMPLATE_FEATURES = Object.freeze({
  admin_new_order: 'orders',
  admin_order_cancelled: 'orders',
  admin_return_requested: 'orders',
  order_placed: 'orders',
  order_cancelled: 'orders',
  order_assigned_staff: 'orders',
  return_requested: 'orders',
  return_status_updated: 'orders',
  guest_order_claim: 'orders',
  admin_order_failed: 'payments',
  payment_failed_customer: 'payments',
  order_refunded: 'payments',
  order_shipped: 'shipping',
  order_delivered: 'shipping',
  order_out_for_delivery: 'shipping',
  delivery_exception: 'shipping',
  low_stock_alert: 'cart',
  low_stock_admin: 'cart',
  inventory_alert_digest: 'cart',
  enquiry_assigned_staff: 'enquiry',
  new_enquiry_admin: 'enquiry',
  new_enquiry_customer: 'enquiry',
  enquiry_reply_customer: 'enquiry',
  newsletter_confirmation: 'newsletter',
  newsletter_campaign: 'newsletter',
  email_verification: 'emailVerification',
  verify_email: 'emailVerification',
});

export const isNotificationTemplateVisible = (name, features) => {
  const feature = Object.hasOwn(TEMPLATE_FEATURES, name) ? TEMPLATE_FEATURES[name] : null;
  return !feature || features?.[feature] === true;
};
