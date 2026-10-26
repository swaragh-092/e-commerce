'use strict';
const template = {
  "name": "staff_invitation",
  "channel": "email",
  "subject": "You are invited to {{store_name}}",
  "body_html": "<!DOCTYPE html><html lang=\"en\"><body style=\"font-family:Arial,sans-serif;color:#222;max-width:600px;margin:32px auto;line-height:1.6\"><h2>{{store_name}}</h2><p>Hi {{name}}, your staff account has been created. Use the setup link to choose your password. This invitation expires in 24 hours. If it expires, request a new password link from the login page.</p>{{#if setup_url}}<p><a href=\"{{setup_url}}\">Set up your account</a></p>{{/if}}{{#if order_id}}<p><a href=\"{{website_url}}/account/orders/{{order_id}}\">View order</a></p>{{/if}}<p>Need help? <a href=\"mailto:{{support_email}}\">{{support_email}}</a></p></body></html>",
  "body_text": "Hi {{name}}, your staff account has been created. Use the setup link to choose your password. This invitation expires in 24 hours. If it expires, request a new password link from the login page.\n{{#if setup_url}}Set up your account: {{setup_url}}{{/if}}\n{{#if order_id}}View order: {{website_url}}/account/orders/{{order_id}}{{/if}}\n{{store_name}}",
  "is_active": true
};
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn('password_reset_tokens', 'purpose', {type:Sequelize.STRING(30),allowNull:false,defaultValue:'password_reset'}, {transaction});
      const [existing] = await queryInterface.sequelize.query('SELECT id FROM notification_templates WHERE name = :name AND channel = :channel', {replacements:{name:template.name,channel:template.channel},transaction});
      if (!existing.length) await queryInterface.bulkInsert('notification_templates', [{...template,created_at:new Date(),updated_at:new Date()}], {transaction});
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn('password_reset_tokens','purpose',{transaction});
      await queryInterface.bulkDelete('notification_templates',{name:template.name,channel:template.channel},{transaction});
    });
  },
};
