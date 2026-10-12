'use strict';
const templates = [
  {
    "name": "delivery_exception",
    "channel": "email",
    "subject": "Delivery update — #{{order_number}}",
    "body_html": "<!DOCTYPE html><html lang=\"en\"><body style=\"font-family:Arial,sans-serif;color:#222;max-width:600px;margin:32px auto;line-height:1.6\"><h2>{{store_name}}</h2><p>Hi {{customer_name}}, your delivery for order #{{order_number}} needs attention. Current status: {{status_label}}. Check your order for updates or contact {{support_email}} for help.</p>{{#if order_id}}<p><a href=\"{{website_url}}/account/orders/{{order_id}}\">View order</a></p>{{/if}}<p>Need help? <a href=\"mailto:{{support_email}}\">{{support_email}}</a></p></body></html>",
    "body_text": "Hi {{customer_name}}, your delivery for order #{{order_number}} needs attention. Current status: {{status_label}}. Check your order for updates or contact {{support_email}} for help.\n{{#if order_id}}View order: {{website_url}}/account/orders/{{order_id}}{{/if}}\n{{store_name}}",
    "is_active": true
  },
  {
    "name": "newsletter_confirmation",
    "channel": "email",
    "subject": "You are subscribed to {{store_name}} updates",
    "body_html": "<!DOCTYPE html><html lang=\"en\"><body style=\"font-family:Arial,sans-serif;max-width:600px;margin:32px auto;line-height:1.6\"><h2>{{store_name}}</h2><p>Thanks for subscribing. You will receive offers, new products, and store updates.</p><p>You can change your choice anytime.</p><p><a href=\"{{unsubscribe_url}}\">Unsubscribe from store updates</a></p></body></html>",
    "body_text": "Thanks for subscribing to {{store_name}} updates. Unsubscribe anytime: {{unsubscribe_url}}",
    "is_active": true
  },
  {
    "name": "newsletter_campaign",
    "channel": "email",
    "subject": "{{campaign_subject}}",
    "body_html": "<!DOCTYPE html><html lang=\"en\"><body style=\"font-family:Arial,sans-serif;max-width:600px;margin:32px auto;line-height:1.6\"><h2>{{store_name}}</h2><div style=\"white-space:pre-wrap\">{{campaign_message}}</div><hr><p>You receive this because you subscribed to store updates.</p>{{#if is_test}}<p>This is a test email. <a href=\"{{unsubscribe_url}}\">Manage email preferences</a></p>{{else}}<p><a href=\"{{unsubscribe_url}}\">Unsubscribe from store updates</a></p>{{/if}}</body></html>",
    "body_text": "{{campaign_message}}\n\n{{#if is_test}}This is a test email. Manage preferences: {{unsubscribe_url}}{{else}}Unsubscribe: {{unsubscribe_url}}{{/if}}",
    "is_active": true
  }
];
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('newsletter_campaigns', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
        subject: { type: Sequelize.STRING(200), allowNull: false },
        message: { type: Sequelize.TEXT, allowNull: false },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'draft' },
        scheduled_at: { type: Sequelize.DATE }, queued_at: { type: Sequelize.DATE }, created_by: { type: Sequelize.UUID },
        recipient_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        created_at: { type: Sequelize.DATE, allowNull: false }, updated_at: { type: Sequelize.DATE, allowNull: false },
      }, { transaction });
      await queryInterface.addIndex('newsletter_campaigns', ['status', 'scheduled_at'], { transaction });
      for (const template of templates) {
        const [existing] = await queryInterface.sequelize.query('SELECT id FROM notification_templates WHERE name = :name AND channel = :channel', { replacements: {name:template.name, channel:template.channel}, transaction });
        if (!existing.length) await queryInterface.bulkInsert('notification_templates', [{...template,created_at:new Date(),updated_at:new Date()}], {transaction});
      }
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('newsletter_campaigns', {transaction});
      await queryInterface.bulkDelete('notification_templates', {name:templates.map((template)=>template.name),channel:'email'}, {transaction});
    });
  },
};
