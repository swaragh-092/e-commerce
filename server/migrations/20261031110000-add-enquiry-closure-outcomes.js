'use strict';

const { randomUUID } = require('crypto');
// These additions are deliberately outside a transaction: PostgreSQL cannot use
// a newly added enum label until the transaction adding it has committed.
module.exports = {
  async up(queryInterface) {
    for (const value of ['closed_converted', 'closed_lost']) {
      await queryInterface.sequelize.query(`ALTER TYPE "enum_enquiries_status" ADD VALUE IF NOT EXISTS '${value}'`);
    }
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const [outcome, message] of [
        ['converted', 'Thank you for choosing us. Your enquiry regarding {{productName}} has been completed.'],
        ['lost', 'Your enquiry regarding {{productName}} has been closed. If you need further assistance or would like to discuss it again, please contact us.'],
      ]) {
        await queryInterface.sequelize.query(`INSERT INTO notification_templates
          (id, name, channel, subject, body_html, body_text, is_active, created_at, updated_at)
          VALUES (:id, :name, 'email', :subject, :html, :text, true, NOW(), NOW())
          ON CONFLICT (name, channel) DO NOTHING`, {
          transaction, replacements: {
            id: randomUUID(), name: `enquiry_closed_${outcome}_customer`,
            subject: 'Update on your enquiry regarding {{productName}} — {{store_name}}',
            html: `<h2>{{store_name}}</h2><p>Hi {{customerName}},</p><p>${message}</p><p>If you have any questions, reply to this email.</p>`,
            text: `Hi {{customerName}},\n\n${message}\n\nIf you have any questions, reply to this email.\n{{store_name}}`,
          },
        });
      }
    });
  },
  async down(queryInterface) {
    // Restore legacy status semantics; retain enum labels and templates because
    // removing labels requires rebuilding the type and templates may be edited.
    await queryInterface.sequelize.query("UPDATE enquiries SET status = 'closed' WHERE status::text IN ('closed_converted', 'closed_lost')");
  },
};
