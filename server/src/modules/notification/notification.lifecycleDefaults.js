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

const variables = {
  password_changed: ['name'],
  email_changed: ['name', 'new_email'],
  staff_invitation: ['name', 'setup_url'],
  order_assigned_staff: ['name', 'order_number', 'order_id'],
  enquiry_assigned_staff: ['name', 'customer_name', 'customer_email', 'enquiry_id'],
  delivery_exception: ['customer_name', 'order_number', 'order_id', 'status_label'],
  return_requested: ['customer_name', 'order_number', 'order_id', 'request_type', 'reason'],
  return_status_updated: ['customer_name', 'order_number', 'order_id', 'request_type', 'status_label', 'resolution_notes'],
  admin_return_requested: ['customer_name', 'customer_email', 'order_number', 'order_id', 'request_type', 'reason'],
};

const buildDefaults = (emailWrapper) => {
  const defaults = Object.fromEntries(Object.entries(definitions).map(([name, [subject, message]]) => {
    const link = name === 'staff_invitation'
      ? '{{#if setup_url}}<a href="{{setup_url}}" class="btn">Set Up Your Account</a>{{/if}}'
      : name === 'enquiry_assigned_staff'
        ? '<a href="{{website_url}}/admin/enquiries" class="btn">View Enquiries</a>'
        : name.endsWith('_staff') || name === 'admin_return_requested'
          ? '{{#if order_id}}<a href="{{website_url}}/admin/orders/{{order_id}}" class="btn">View Order</a>{{/if}}'
          : ['password_changed', 'email_changed'].includes(name)
            ? ''
            : '{{#if order_id}}<a href="{{website_url}}/account/orders/{{order_id}}" class="btn">View Order</a>{{/if}}';
    const body = `<h2>${name === 'staff_invitation' ? 'Welcome to the team' : name === 'order_assigned_staff' ? 'Order assigned to you' : name === 'enquiry_assigned_staff' ? 'Enquiry assigned to you' : name === 'admin_return_requested' ? 'New return or replacement request' : 'Account and order update'}</h2><p>${message}</p>${link}<hr class="divider"><p style="font-size:13px;color:#888">Need help? <a href="mailto:{{support_email}}">{{support_email}}</a></p>`;
    const textLink = name === 'staff_invitation'
      ? '\n{{#if setup_url}}Set up your account: {{setup_url}}{{/if}}'
      : name === 'enquiry_assigned_staff'
        ? '\nView enquiries: {{website_url}}/admin/enquiries'
        : name.endsWith('_staff') || name === 'admin_return_requested'
          ? '\n{{#if order_id}}View order: {{website_url}}/admin/orders/{{order_id}}{{/if}}'
          : ['password_changed', 'email_changed'].includes(name)
            ? ''
            : '\n{{#if order_id}}View order: {{website_url}}/account/orders/{{order_id}}{{/if}}';
    return [name, { subject, bodyHtml: emailWrapper(body), bodyText: `${message}${textLink}\n\nNeed help? {{support_email}}\n{{store_name}}` }];
  }));

  defaults.newsletter_confirmation = {
    subject: 'You are subscribed to {{store_name}} updates',
    bodyHtml: emailWrapper('<h2>Thanks for subscribing!</h2><p>You will receive offers, new products, and store updates from {{store_name}}.</p><p>You can change your choice anytime.</p><a href="{{unsubscribe_url}}" class="btn">Manage Email Preferences</a>'),
    bodyText: 'Thanks for subscribing to {{store_name}} updates. Manage your email preferences anytime: {{unsubscribe_url}}',
  };
  defaults.newsletter_campaign = {
    subject: '{{campaign_subject}}',
    bodyHtml: emailWrapper('<h2>{{campaign_subject}}</h2><div style="white-space:pre-wrap">{{campaign_message}}</div><hr class="divider"><p>You receive this because you subscribed to store updates.</p>{{#if is_test}}<p>This is a test email. <a href="{{unsubscribe_url}}">Manage email preferences</a></p>{{else}}<p><a href="{{unsubscribe_url}}">Unsubscribe from store updates</a></p>{{/if}}'),
    bodyText: '{{campaign_message}}\n\n{{#if is_test}}This is a test email. Manage preferences: {{unsubscribe_url}}{{else}}Unsubscribe: {{unsubscribe_url}}{{/if}}',
  };
  return defaults;
};

const commonVariables = ['website_url', 'store_name', 'support_email'];
module.exports = {
  buildDefaults,
  DEFAULTS: {},
  TEMPLATE_VARIABLES: {
    ...Object.fromEntries(Object.entries(variables).map(([name, vars]) => [name, [...vars, ...commonVariables]])),
    newsletter_confirmation: ['unsubscribe_url', 'store_name'],
    newsletter_campaign: ['campaign_subject', 'campaign_message', 'unsubscribe_url', 'is_test', 'store_name'],
  },
};
