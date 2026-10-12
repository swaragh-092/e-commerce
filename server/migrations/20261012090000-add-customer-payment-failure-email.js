'use strict';

module.exports = {
  async up(queryInterface) {
    const existing = await queryInterface.sequelize.query(
      "SELECT id FROM notification_templates WHERE name = 'payment_failed_customer' AND channel = 'email'",
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );
    if (existing.length) return;

    const now = new Date();
    await queryInterface.bulkInsert('notification_templates', [{
      name: 'payment_failed_customer',
      channel: 'email',
      subject: 'Payment failed for Order #{{order_number}}',
      body_html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#222;max-width:600px;margin:32px auto;line-height:1.6"><h2>We couldn't process your payment</h2><p>Hi {{customer_name}}, payment for order <strong>#{{order_number}}</strong> could not be completed.</p>{{#if failure_reason}}<p><strong>Reason:</strong> {{failure_reason}}</p>{{/if}}<p>You can return to checkout and try another payment method.</p><p><a href="{{website_url}}/payment/failure?orderId={{order_id}}">Review payment</a></p><p>Need help? <a href="mailto:{{support_email}}">{{support_email}}</a></p><p>{{store_name}}</p></body></html>`,
      body_text: 'Hi {{customer_name}}, payment for order #{{order_number}} could not be completed. {{#if failure_reason}}Reason: {{failure_reason}}. {{/if}}Review payment: {{website_url}}/payment/failure?orderId={{order_id}}\n\n{{store_name}}',
      is_active: true,
      created_at: now,
      updated_at: now,
    }]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('notification_templates', { name: 'payment_failed_customer', channel: 'email' });
  },
};
