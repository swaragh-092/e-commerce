'use strict';

const definitions = {
  password_changed: ['Your password was changed', 'Hi {{name}}, the password for your account was changed. If you did not make this change, contact {{support_email}} immediately.'],
  email_changed: ['Your account email was changed', 'Hi {{name}}, your account email was changed to {{new_email}}. If you did not make this change, contact {{support_email}} immediately.'],
  staff_invitation: ['You are invited to {{store_name}}', 'Hi {{name}}, your staff account has been created. Use the setup link to choose your password. This invitation expires in 24 hours. If it expires, request a new password link from the login page.'],
  order_assigned_staff: ['Order #{{order_number}} assigned to you', 'Hi {{name}}, order #{{order_number}} has been assigned to you. Open the order to review its details and take the next action.'],
  enquiry_assigned_staff: ['Customer enquiry assigned to you', 'Hi {{name}}, an enquiry from {{customer_name}} ({{customer_email}}) has been assigned to you. Open the enquiries dashboard to review and reply.'],
  delivery_exception: ['Delivery update — #{{order_number}}', 'Hi {{customer_name}}, your delivery for order #{{order_number}} needs attention. Current status: {{status_label}}. Check your order for updates or contact {{support_email}} for help.'],
  return_requested: ['{{request_type}} request received — #{{order_number}}', 'Hi {{customer_name}}, we received your {{request_type}} request for order #{{order_number}}. Reason: {{reason}}. Our team will review your request and send you an update.'],
  return_status_updated: ['{{request_type}} update — #{{order_number}}', 'Hi {{customer_name}}, your {{request_type}} request for order #{{order_number}} is now {{status_label}}. {{resolution_notes}} Please check your order for the latest instructions.'],
  admin_return_requested: ['New {{request_type}} request — #{{order_number}}', '{{customer_name}} ({{customer_email}}) requested a {{request_type}} for order #{{order_number}}. Reason: {{reason}}. Review the request in the order details.'],
};

const variables = ['name', 'customer_name', 'customer_email', 'order_number', 'order_id', 'enquiry_id', 'request_type', 'reason', 'status_label', 'resolution_notes', 'new_email', 'setup_url', 'website_url', 'store_name', 'support_email'];
const DEFAULTS = Object.fromEntries(Object.entries(definitions).map(([name, [subject, message]]) => [name, {
  subject,
  bodyHtml: `<!DOCTYPE html><html lang="en"><body style="font-family:Arial,sans-serif;color:#222;max-width:600px;margin:32px auto;line-height:1.6"><h2>{{store_name}}</h2><p>${message}</p>{{#if setup_url}}<p><a href="{{setup_url}}">Set up your account</a></p>{{/if}}{{#if enquiry_id}}<p><a href="{{website_url}}/admin/enquiries">View enquiry {{enquiry_id}}</a></p>{{/if}}{{#if order_id}}<p><a href="{{website_url}}/${name.startsWith('admin_') || name.endsWith('_staff') ? 'admin/orders' : 'account/orders'}/{{order_id}}">View order</a></p>{{/if}}<p>Need help? <a href="mailto:{{support_email}}">{{support_email}}</a></p></body></html>`,
  bodyText: `${message}\n{{#if setup_url}}Set up your account: {{setup_url}}{{/if}}\n{{#if enquiry_id}}View enquiry {{enquiry_id}}: {{website_url}}/admin/enquiries{{/if}}\n{{#if order_id}}View order: {{website_url}}/${name.startsWith('admin_') || name.endsWith('_staff') ? 'admin/orders' : 'account/orders'}/{{order_id}}{{/if}}\n{{store_name}}`,
}]));

DEFAULTS.newsletter_confirmation = {
  subject: 'You are subscribed to {{store_name}} updates',
  bodyHtml: '<!DOCTYPE html><html lang="en"><body style="font-family:Arial,sans-serif;max-width:600px;margin:32px auto;line-height:1.6"><h2>{{store_name}}</h2><p>Thanks for subscribing. You will receive offers, new products, and store updates.</p><p>You can change your choice anytime.</p><p><a href="{{unsubscribe_url}}">Unsubscribe from store updates</a></p></body></html>',
  bodyText: 'Thanks for subscribing to {{store_name}} updates. Unsubscribe anytime: {{unsubscribe_url}}',
};
DEFAULTS.newsletter_campaign = {
  subject: '{{campaign_subject}}',
  bodyHtml: '<!DOCTYPE html><html lang="en"><body style="font-family:Arial,sans-serif;max-width:600px;margin:32px auto;line-height:1.6"><h2>{{store_name}}</h2><div style="white-space:pre-wrap">{{campaign_message}}</div><hr><p>You receive this because you subscribed to store updates.</p>{{#if is_test}}<p>This is a test email. <a href="{{unsubscribe_url}}">Manage email preferences</a></p>{{else}}<p><a href="{{unsubscribe_url}}">Unsubscribe from store updates</a></p>{{/if}}</body></html>',
  bodyText: '{{campaign_message}}\n\n{{#if is_test}}This is a test email. Manage preferences: {{unsubscribe_url}}{{else}}Unsubscribe: {{unsubscribe_url}}{{/if}}',
};

module.exports = { DEFAULTS, TEMPLATE_VARIABLES: {
  ...Object.fromEntries(Object.keys(definitions).map((name) => [name, variables])),
  newsletter_confirmation: ['store_name', 'unsubscribe_url'],
  newsletter_campaign: ['campaign_subject', 'campaign_message', 'store_name', 'unsubscribe_url', 'is_test'],
} };
