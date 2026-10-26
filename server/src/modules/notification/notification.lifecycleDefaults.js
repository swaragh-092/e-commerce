'use strict';

const templateConfigs = {
  admin_return_requested: {
    subject: 'New {{request_type}} request — #{{order_number}}',
    buildHtml: () => `
    <h2>New Return or Replacement 🔄</h2>
    <p>A customer has submitted a <strong>{{request_type}}</strong> request for order <strong>#{{order_number}}</strong>.</p>
    <div class="info-box">
      <p><strong>Order Number:</strong> #{{order_number}}</p>
      <p><strong>Customer:</strong> {{customer_name}} ({{customer_email}})</p>
      <p><strong>Request Type:</strong> {{request_type}}</p>
      <p><strong>Reason:</strong> {{reason}}</p>
    </div>
    {{#if order_id}}<a href="{{website_url}}/admin/orders/{{order_id}}" class="btn">View Order</a>{{/if}}
    <hr class="divider">
    <p style="font-size:13px;color:#888">Need help? <a href="mailto:{{support_email}}">{{support_email}}</a></p>
`,
    bodyText: '{{customer_name}} ({{customer_email}}) requested a {{request_type}} for order #{{order_number}}. Reason: {{reason}}.\n\n{{#if order_id}}View order: {{website_url}}/admin/orders/{{order_id}}{{/if}}\n\nNeed help? {{support_email}}\n{{store_name}}',
  },

  delivery_exception: {
    subject: 'Delivery update — #{{order_number}}',
    buildHtml: () => `
    <h2>Delivery Exception 🚚</h2>
    <p>Hi {{customer_name}}, your delivery for order <strong>#{{order_number}}</strong> needs attention.</p>
    <div class="info-box">
      <p><strong>Order Number:</strong> #{{order_number}}</p>
      <p><strong>Current Status:</strong> {{status_label}}</p>
    </div>
    <p>Please check your order for updates or contact our support team for assistance.</p>
    {{#if order_id}}<a href="{{website_url}}/account/orders/{{order_id}}" class="btn">View Order</a>{{/if}}
    <hr class="divider">
    <p style="font-size:13px;color:#888">Need help? <a href="mailto:{{support_email}}">{{support_email}}</a></p>
`,
    bodyText: 'Hi {{customer_name}}, your delivery for order #{{order_number}} needs attention. Current status: {{status_label}}.\n\n{{#if order_id}}View order: {{website_url}}/account/orders/{{order_id}}{{/if}}\n\nNeed help? {{support_email}}\n{{store_name}}',
  },

  email_changed: {
    subject: 'Your account email was changed',
    buildHtml: () => `
    <h2>Account Email Changed 🔒</h2>
    <p>Hi {{name}},</p>
    <p>The email address associated with your <strong>{{store_name}}</strong> account was recently changed to <strong>{{new_email}}</strong>.</p>
    <div class="info-box">
      <p><strong>New Email Address:</strong> {{new_email}}</p>
    </div>
    <p>If you made this change, you can safely ignore this notification.</p>
    <p><strong>If you did not make this change</strong>, please contact our support team immediately at <a href="mailto:{{support_email}}">{{support_email}}</a> to secure your account.</p>
    <hr class="divider">
    <p style="font-size:13px;color:#888">Need help? <a href="mailto:{{support_email}}">{{support_email}}</a></p>
`,
    bodyText: 'Hi {{name}}, your account email was changed to {{new_email}}. If you did not make this change, contact {{support_email}} immediately.\n\n{{store_name}}',
  },

  password_changed: {
    subject: 'Your password was changed',
    buildHtml: () => `
    <h2>Password Changed 🔒</h2>
    <p>Hi {{name}},</p>
    <p>The password for your <strong>{{store_name}}</strong> account was recently changed.</p>
    <p>If you made this change, you can safely ignore this notification.</p>
    <p><strong>If you did not make this change</strong>, please reset your password immediately or contact our support team at <a href="mailto:{{support_email}}">{{support_email}}</a>.</p>
    <a href="{{website_url}}/forgot-password" class="btn">Reset Password</a>
    <hr class="divider">
    <p style="font-size:13px;color:#888">Need help? <a href="mailto:{{support_email}}">{{support_email}}</a></p>
`,
    bodyText: 'Hi {{name}}, the password for your account was changed. If you did not make this change, contact {{support_email}} immediately.\n\n{{store_name}}',
  },

  staff_invitation: {
    subject: 'You are invited to {{store_name}}',
    buildHtml: () => `
    <h2>Welcome to the Team! 👋</h2>
    <p>Hi {{name}}, your staff account has been created on <strong>{{store_name}}</strong>.</p>
    <div class="info-box">
      <p>Click the button below to set up your password and access your dashboard. This invitation expires in 24 hours.</p>
    </div>
    {{#if setup_url}}<a href="{{setup_url}}" class="btn">Set Up Your Account</a>{{/if}}
    <hr class="divider">
    <p style="font-size:13px;color:#888">If the link expires, request a new password link from the login page.</p>
`,
    bodyText: 'Hi {{name}}, your staff account has been created. Use the setup link to choose your password. This invitation expires in 24 hours.\n\n{{#if setup_url}}Set up your account: {{setup_url}}{{/if}}\n\nNeed help? {{support_email}}\n{{store_name}}',
  },

  order_assigned_staff: {
    subject: 'Order #{{order_number}} assigned to you',
    buildHtml: () => `
    <h2>Order Assigned to You 📋</h2>
    <p>Hi {{name}}, order <strong>#{{order_number}}</strong> has been assigned to you.</p>
    <div class="info-box">
      <p><strong>Order Number:</strong> #{{order_number}}</p>
    </div>
    <p>Open the order to review its details and take the next action.</p>
    {{#if order_id}}<a href="{{website_url}}/admin/orders/{{order_id}}" class="btn">View Order</a>{{/if}}
    <hr class="divider">
    <p style="font-size:13px;color:#888">Need help? <a href="mailto:{{support_email}}">{{support_email}}</a></p>
`,
    bodyText: 'Hi {{name}}, order #{{order_number}} has been assigned to you.\n\n{{#if order_id}}View order: {{website_url}}/admin/orders/{{order_id}}{{/if}}\n\nNeed help? {{support_email}}\n{{store_name}}',
  },

  enquiry_assigned_staff: {
    subject: 'Customer enquiry assigned to you',
    buildHtml: () => `
    <h2>Customer Enquiry Assigned 📬</h2>
    <p>Hi {{name}}, an enquiry from <strong>{{customer_name}}</strong> ({{customer_email}}) has been assigned to you.</p>
    <div class="info-box">
      <p><strong>Customer:</strong> {{customer_name}} ({{customer_email}})</p>
    </div>
    <p>Open the enquiries dashboard to review the message and reply to the customer.</p>
    <a href="{{website_url}}/admin/enquiries" class="btn">View Enquiries</a>
    <hr class="divider">
    <p style="font-size:13px;color:#888">Need help? <a href="mailto:{{support_email}}">{{support_email}}</a></p>
`,
    bodyText: 'Hi {{name}}, an enquiry from {{customer_name}} ({{customer_email}}) has been assigned to you.\n\nView enquiries: {{website_url}}/admin/enquiries\n\nNeed help? {{support_email}}\n{{store_name}}',
  },

  return_requested: {
    subject: '{{request_type}} request received — #{{order_number}}',
    buildHtml: () => `
    <h2>{{request_type}} Request Received 📦</h2>
    <p>Hi {{customer_name}}, we received your <strong>{{request_type}}</strong> request for order <strong>#{{order_number}}</strong>.</p>
    <div class="info-box">
      <p><strong>Order Number:</strong> #{{order_number}}</p>
      <p><strong>Request Type:</strong> {{request_type}}</p>
      <p><strong>Reason:</strong> {{reason}}</p>
    </div>
    <p>Our team will review your request and send you an update with the next steps.</p>
    {{#if order_id}}<a href="{{website_url}}/account/orders/{{order_id}}" class="btn">View Order</a>{{/if}}
    <hr class="divider">
    <p style="font-size:13px;color:#888">Need help? <a href="mailto:{{support_email}}">{{support_email}}</a></p>
`,
    bodyText: 'Hi {{customer_name}}, we received your {{request_type}} request for order #{{order_number}}. Reason: {{reason}}.\n\n{{#if order_id}}View order: {{website_url}}/account/orders/{{order_id}}{{/if}}\n\nNeed help? {{support_email}}\n{{store_name}}',
  },

  return_status_updated: {
    subject: '{{request_type}} update — #{{order_number}}',
    buildHtml: () => `
    <h2>{{request_type}} Request Update 🔄</h2>
    <p>Hi {{customer_name}}, your <strong>{{request_type}}</strong> request for order <strong>#{{order_number}}</strong> is now <strong>{{status_label}}</strong>.</p>
    <div class="info-box">
      <p><strong>Order Number:</strong> #{{order_number}}</p>
      <p><strong>Current Status:</strong> {{status_label}}</p>
      {{#if resolution_notes}}<p><strong>Resolution:</strong> {{resolution_notes}}</p>{{/if}}
    </div>
    <p>Please check your order for the latest instructions.</p>
    {{#if order_id}}<a href="{{website_url}}/account/orders/{{order_id}}" class="btn">View Order</a>{{/if}}
    <hr class="divider">
    <p style="font-size:13px;color:#888">Need help? <a href="mailto:{{support_email}}">{{support_email}}</a></p>
`,
    bodyText: 'Hi {{customer_name}}, your {{request_type}} request for order #{{order_number}} is now {{status_label}}. {{resolution_notes}}\n\n{{#if order_id}}View order: {{website_url}}/account/orders/{{order_id}}{{/if}}\n\nNeed help? {{support_email}}\n{{store_name}}',
  },
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
  const defaults = Object.fromEntries(
    Object.entries(templateConfigs).map(([name, config]) => [
      name,
      {
        subject: config.subject,
        bodyHtml: emailWrapper(config.buildHtml()),
        bodyText: config.bodyText,
      },
    ])
  );

  defaults.newsletter_confirmation = {
    subject: 'You are subscribed to {{store_name}} updates',
    bodyHtml: emailWrapper(`
    <h2>Thanks for Subscribing! 🎉</h2>
    <p>You're now subscribed to store updates, special offers, and new arrivals from <strong>{{store_name}}</strong>.</p>
    <p>You can manage your email preferences or unsubscribe at any time.</p>
    <a href="{{unsubscribe_url}}" class="btn">Manage Email Preferences</a>
`),
    bodyText: 'Thanks for subscribing to {{store_name}} updates. Manage your email preferences anytime: {{unsubscribe_url}}',
  };

  defaults.newsletter_campaign = {
    subject: '{{campaign_subject}}',
    bodyHtml: emailWrapper(`
    <h2>{{campaign_subject}}</h2>
    <div style="white-space:pre-wrap;font-size:15px;line-height:1.7;color:#444;margin:16px 0;">{{campaign_message}}</div>
    <hr class="divider">
    <p style="font-size:12px;color:#888">You are receiving this email because you subscribed to store updates from {{store_name}}.</p>
    {{#if is_test}}<p style="font-size:12px;color:#888">This is a test email. <a href="{{unsubscribe_url}}">Manage email preferences</a></p>{{else}}<p style="font-size:12px;color:#888"><a href="{{unsubscribe_url}}">Unsubscribe from store updates</a></p>{{/if}}
`),
    bodyText: '{{campaign_message}}\n\n{{#if is_test}}This is a test email. Manage preferences: {{unsubscribe_url}}{{else}}Unsubscribe: {{unsubscribe_url}}{{/if}}',
  };

  return defaults;
};

const commonVariables = ['website_url', 'store_name', 'support_email', 'store_logo', 'copyright', 'current_year'];

module.exports = {
  buildDefaults,
  DEFAULTS: {},
  TEMPLATE_VARIABLES: {
    ...Object.fromEntries(Object.entries(variables).map(([name, vars]) => [name, [...vars, ...commonVariables]])),
    newsletter_confirmation: ['unsubscribe_url', 'store_name', ...commonVariables],
    newsletter_campaign: ['campaign_subject', 'campaign_message', 'unsubscribe_url', 'is_test', 'store_name', ...commonVariables],
  },
};
