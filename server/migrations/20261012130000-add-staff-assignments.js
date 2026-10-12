'use strict';
const templates = [
  {
    "name": "order_assigned_staff",
    "channel": "email",
    "subject": "Order #{{order_number}} assigned to you",
    "body_html": "<!DOCTYPE html><html lang=\"en\"><body style=\"font-family:Arial,sans-serif;color:#222;max-width:600px;margin:32px auto;line-height:1.6\"><h2>{{store_name}}</h2><p>Hi {{name}}, order #{{order_number}} has been assigned to you. Open the order to review its details and take the next action.</p>{{#if setup_url}}<p><a href=\"{{setup_url}}\">Set up your account</a></p>{{/if}}{{#if enquiry_id}}<p><a href=\"{{website_url}}/admin/enquiries\">View enquiry {{enquiry_id}}</a></p>{{/if}}{{#if order_id}}<p><a href=\"{{website_url}}/admin/orders/{{order_id}}\">View order</a></p>{{/if}}<p>Need help? <a href=\"mailto:{{support_email}}\">{{support_email}}</a></p></body></html>",
    "body_text": "Hi {{name}}, order #{{order_number}} has been assigned to you. Open the order to review its details and take the next action.\n{{#if setup_url}}Set up your account: {{setup_url}}{{/if}}\n{{#if enquiry_id}}View enquiry {{enquiry_id}}: {{website_url}}/admin/enquiries{{/if}}\n{{#if order_id}}View order: {{website_url}}/admin/orders/{{order_id}}{{/if}}\n{{store_name}}",
    "is_active": true
  },
  {
    "name": "enquiry_assigned_staff",
    "channel": "email",
    "subject": "Customer enquiry assigned to you",
    "body_html": "<!DOCTYPE html><html lang=\"en\"><body style=\"font-family:Arial,sans-serif;color:#222;max-width:600px;margin:32px auto;line-height:1.6\"><h2>{{store_name}}</h2><p>Hi {{name}}, an enquiry from {{customer_name}} ({{customer_email}}) has been assigned to you. Open the enquiries dashboard to review and reply.</p>{{#if setup_url}}<p><a href=\"{{setup_url}}\">Set up your account</a></p>{{/if}}{{#if enquiry_id}}<p><a href=\"{{website_url}}/admin/enquiries\">View enquiry {{enquiry_id}}</a></p>{{/if}}{{#if order_id}}<p><a href=\"{{website_url}}/admin/orders/{{order_id}}\">View order</a></p>{{/if}}<p>Need help? <a href=\"mailto:{{support_email}}\">{{support_email}}</a></p></body></html>",
    "body_text": "Hi {{name}}, an enquiry from {{customer_name}} ({{customer_email}}) has been assigned to you. Open the enquiries dashboard to review and reply.\n{{#if setup_url}}Set up your account: {{setup_url}}{{/if}}\n{{#if enquiry_id}}View enquiry {{enquiry_id}}: {{website_url}}/admin/enquiries{{/if}}\n{{#if order_id}}View order: {{website_url}}/admin/orders/{{order_id}}{{/if}}\n{{store_name}}",
    "is_active": true
  }
];
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const table of ['orders','enquiries']) {
        await queryInterface.addColumn(table,'assigned_user_id',{type:Sequelize.UUID,allowNull:true,references:{model:'users',key:'id'},onDelete:'SET NULL',onUpdate:'CASCADE'},{transaction});
        await queryInterface.addIndex(table,['assigned_user_id'],{transaction});
      }
      for (const template of templates) {
        const [existing] = await queryInterface.sequelize.query('SELECT id FROM notification_templates WHERE name = :name AND channel = :channel',{replacements:{name:template.name,channel:template.channel},transaction});
        if (!existing.length) await queryInterface.bulkInsert('notification_templates',[{...template,created_at:new Date(),updated_at:new Date()}],{transaction});
      }
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const table of ['orders','enquiries']) await queryInterface.removeColumn(table,'assigned_user_id',{transaction});
      await queryInterface.bulkDelete('notification_templates',{name:templates.map((template)=>template.name),channel:'email'},{transaction});
    });
  },
};
