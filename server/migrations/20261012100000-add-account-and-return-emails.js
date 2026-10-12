'use strict';

// Frozen template definitions for this migration.
const templates = [
  {
    "name": "password_changed",
    "channel": "email",
    "subject": "Your password was changed",
    "body_html": "<!DOCTYPE html><html lang=\"en\"><body style=\"font-family:Arial,sans-serif;color:#222;max-width:600px;margin:32px auto;line-height:1.6\"><h2>{{store_name}}</h2><p>Hi {{name}}, the password for your account was changed. If you did not make this change, contact {{support_email}} immediately.</p>{{#if order_id}}<p><a href=\"{{website_url}}/account/orders/{{order_id}}\">View order</a></p>{{/if}}<p>Need help? <a href=\"mailto:{{support_email}}\">{{support_email}}</a></p></body></html>",
    "body_text": "Hi {{name}}, the password for your account was changed. If you did not make this change, contact {{support_email}} immediately.\n{{#if order_id}}View order: {{website_url}}/account/orders/{{order_id}}{{/if}}\n{{store_name}}",
    "is_active": true
  },
  {
    "name": "email_changed",
    "channel": "email",
    "subject": "Your account email was changed",
    "body_html": "<!DOCTYPE html><html lang=\"en\"><body style=\"font-family:Arial,sans-serif;color:#222;max-width:600px;margin:32px auto;line-height:1.6\"><h2>{{store_name}}</h2><p>Hi {{name}}, your account email was changed to {{new_email}}. If you did not make this change, contact {{support_email}} immediately.</p>{{#if order_id}}<p><a href=\"{{website_url}}/account/orders/{{order_id}}\">View order</a></p>{{/if}}<p>Need help? <a href=\"mailto:{{support_email}}\">{{support_email}}</a></p></body></html>",
    "body_text": "Hi {{name}}, your account email was changed to {{new_email}}. If you did not make this change, contact {{support_email}} immediately.\n{{#if order_id}}View order: {{website_url}}/account/orders/{{order_id}}{{/if}}\n{{store_name}}",
    "is_active": true
  },
  {
    "name": "return_requested",
    "channel": "email",
    "subject": "{{request_type}} request received — #{{order_number}}",
    "body_html": "<!DOCTYPE html><html lang=\"en\"><body style=\"font-family:Arial,sans-serif;color:#222;max-width:600px;margin:32px auto;line-height:1.6\"><h2>{{store_name}}</h2><p>Hi {{customer_name}}, we received your {{request_type}} request for order #{{order_number}}. Reason: {{reason}}. Our team will review your request and send you an update.</p>{{#if order_id}}<p><a href=\"{{website_url}}/account/orders/{{order_id}}\">View order</a></p>{{/if}}<p>Need help? <a href=\"mailto:{{support_email}}\">{{support_email}}</a></p></body></html>",
    "body_text": "Hi {{customer_name}}, we received your {{request_type}} request for order #{{order_number}}. Reason: {{reason}}. Our team will review your request and send you an update.\n{{#if order_id}}View order: {{website_url}}/account/orders/{{order_id}}{{/if}}\n{{store_name}}",
    "is_active": true
  },
  {
    "name": "return_status_updated",
    "channel": "email",
    "subject": "{{request_type}} update — #{{order_number}}",
    "body_html": "<!DOCTYPE html><html lang=\"en\"><body style=\"font-family:Arial,sans-serif;color:#222;max-width:600px;margin:32px auto;line-height:1.6\"><h2>{{store_name}}</h2><p>Hi {{customer_name}}, your {{request_type}} request for order #{{order_number}} is now {{status_label}}. {{resolution_notes}} Please check your order for the latest instructions.</p>{{#if order_id}}<p><a href=\"{{website_url}}/account/orders/{{order_id}}\">View order</a></p>{{/if}}<p>Need help? <a href=\"mailto:{{support_email}}\">{{support_email}}</a></p></body></html>",
    "body_text": "Hi {{customer_name}}, your {{request_type}} request for order #{{order_number}} is now {{status_label}}. {{resolution_notes}} Please check your order for the latest instructions.\n{{#if order_id}}View order: {{website_url}}/account/orders/{{order_id}}{{/if}}\n{{store_name}}",
    "is_active": true
  },
  {
    "name": "admin_return_requested",
    "channel": "email",
    "subject": "New {{request_type}} request — #{{order_number}}",
    "body_html": "<!DOCTYPE html><html lang=\"en\"><body style=\"font-family:Arial,sans-serif;color:#222;max-width:600px;margin:32px auto;line-height:1.6\"><h2>{{store_name}}</h2><p>{{customer_name}} ({{customer_email}}) requested a {{request_type}} for order #{{order_number}}. Reason: {{reason}}. Review the request in the order details.</p>{{#if order_id}}<p><a href=\"{{website_url}}/admin/orders/{{order_id}}\">View order</a></p>{{/if}}<p>Need help? <a href=\"mailto:{{support_email}}\">{{support_email}}</a></p></body></html>",
    "body_text": "{{customer_name}} ({{customer_email}}) requested a {{request_type}} for order #{{order_number}}. Reason: {{reason}}. Review the request in the order details.\n{{#if order_id}}View order: {{website_url}}/admin/orders/{{order_id}}{{/if}}\n{{store_name}}",
    "is_active": true
  }
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const template of templates) {
        const [existing] = await queryInterface.sequelize.query('SELECT id FROM notification_templates WHERE name = :name AND channel = :channel', { replacements: { name: template.name, channel: template.channel }, transaction });
        if (!existing.length) await queryInterface.bulkInsert('notification_templates', [{ ...template, created_at: new Date(), updated_at: new Date() }], { transaction });
      }
    });
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('notification_templates', { name: templates.map((template) => template.name), channel: 'email' });
  },
};
