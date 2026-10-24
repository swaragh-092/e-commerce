'use strict';

const { DEFAULTS } = require('../src/modules/notification/notification.defaults');

const BACKUP_TABLE = 'notification_templates_backup_20261024';

/**
 * Checks whether an email template was customized by an administrator in the UI.
 *
 * An administrator edit in the UI updates `updated_at` well after initial seeding (`created_at`),
 * and produces content different from the canonical standardized default.
 * Unmodified built-ins maintain synchronous `created_at` and `updated_at` timestamps from initial seeder insertion.
 */
const isCustomized = (template, defaultData) => {
  if (!template || !template.body_html) return false;

  // If the template already matches the canonical standardized default, it is not considered customized
  if (defaultData && template.body_html.trim() === defaultData.bodyHtml.trim()) {
    return false;
  }

  if (template.created_at && template.updated_at) {
    const timeDiff = Math.abs(new Date(template.updated_at).getTime() - new Date(template.created_at).getTime());
    // An update timestamp more than 10 seconds after creation indicates post-seed modification
    if (timeDiff > 10000) {
      // Templates updated by the 20261001000000 standardization migration
      if (['new_enquiry_customer', 'enquiry_reply_customer'].includes(template.name)) {
        return false;
      }
      return true;
    }
  }

  return false;
};

module.exports = {
  isCustomized,

  async up(queryInterface) {
    // 1. Create backup snapshot of all existing email templates for non-destructive, reversible rollback
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS ${BACKUP_TABLE}`);
    await queryInterface.sequelize.query(`
      CREATE TABLE ${BACKUP_TABLE} AS
      SELECT * FROM notification_templates WHERE channel = 'email'
    `);

    // 2. Fetch existing email templates
    const templates = await queryInterface.sequelize.query(
      `SELECT id, name, channel, body_html, subject, body_text, is_active, created_at, updated_at
       FROM notification_templates
       WHERE channel = 'email'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    for (const template of templates) {
      let defaultData = DEFAULTS[template.name];
      if (!defaultData && template.name === 'verify_email') {
        defaultData = DEFAULTS['email_verification'];
      }

      if (!defaultData) continue;

      // Preserve templates that administrators customized in the UI
      if (isCustomized(template, defaultData)) {
        continue;
      }

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
  },

  async down(queryInterface) {
    try {
      const backups = await queryInterface.sequelize.query(
        `SELECT id, subject, body_html, body_text, is_active, updated_at FROM ${BACKUP_TABLE}`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );

      for (const backup of backups) {
        await queryInterface.sequelize.query(
          `UPDATE notification_templates
           SET subject = :subject,
               body_html = :body_html,
               body_text = :body_text,
               is_active = :is_active,
               updated_at = :updated_at
           WHERE id = :id`,
          {
            replacements: {
              id: backup.id,
              subject: backup.subject,
              body_html: backup.body_html,
              body_text: backup.body_text,
              is_active: backup.is_active,
              updated_at: backup.updated_at,
            },
          }
        );
      }

      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS ${BACKUP_TABLE}`);
    } catch (_) {
      // If backup table does not exist or has already been dropped, gracefully exit
    }
  },
};
