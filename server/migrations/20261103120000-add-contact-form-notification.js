'use strict';

const { randomUUID } = require('crypto');
const { DEFAULTS } = require('../src/modules/notification/notification.defaults');

module.exports = {
  async up(queryInterface) {
    const template = DEFAULTS.contact_form_admin;
    await queryInterface.sequelize.query(`
      INSERT INTO notification_templates
        (id, name, channel, subject, body_html, body_text, is_active, created_at, updated_at)
      VALUES (:id, :name, 'email', :subject, :html, :text, true, NOW(), NOW())
      ON CONFLICT (name, channel) DO NOTHING
    `, { replacements: {
      id: randomUUID(), name: 'contact_form_admin', subject: template.subject,
      html: template.bodyHtml, text: template.bodyText,
    } });
  },
  async down() {
    // Keep the template and any administrator edits if application code is rolled back.
  },
};
