'use strict';

const { DEFAULTS } = require('../src/modules/notification/notification.defaults');

module.exports = {
  async up(queryInterface) {
    const templates = await queryInterface.sequelize.query(
      `SELECT id, name, channel, body_html, subject, body_text FROM notification_templates WHERE channel = 'email'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    for (const template of templates) {
      let defaultData = DEFAULTS[template.name];
      if (!defaultData && template.name === 'verify_email') {
        defaultData = DEFAULTS['email_verification'];
      }

      if (defaultData) {
        await queryInterface.sequelize.query(
          `UPDATE notification_templates
           SET body_html = :body_html,
               body_text = COALESCE(:body_text, body_text),
               subject = COALESCE(:subject, subject),
               updated_at = :updated_at
           WHERE id = :id`,
          {
            replacements: {
              id: template.id,
              body_html: defaultData.bodyHtml,
              body_text: defaultData.bodyText || null,
              subject: defaultData.subject || null,
              updated_at: new Date(),
            },
          }
        );
      }
    }
  },

  async down() {
    // Non-destructive rollback: standardized layout preserves styling and content.
  },
};
