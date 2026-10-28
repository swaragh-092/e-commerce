'use strict';

// Double opt-in + consent evidence:
//  - new subscribers land as 'pending' until they click the confirm link
//  - consent_ip / consent_user_agent record who requested the subscription
//  - newsletter_confirm template carries the verify link
// Existing 'active' rows are grandfathered (consent predates this migration).

const confirmTemplate = {
  name: 'newsletter_confirm',
  channel: 'email',
  subject: 'Confirm your subscription to {{store_name}}',
  body_html: '<!DOCTYPE html><html lang="en"><body style="font-family:Arial,sans-serif;max-width:600px;margin:32px auto;line-height:1.6"><h2>{{store_name}}</h2><p>Thanks for signing up for store updates. One last step — confirm your email address:</p><p><a href="{{confirm_url}}">Confirm subscription</a></p><p>If you didn\'t request this, ignore this email; you won\'t be subscribed.</p></body></html>',
  body_text: 'Confirm your subscription to {{store_name}} updates: {{confirm_url}}\n\nIf you didn\'t request this, ignore this email; you won\'t be subscribed.',
  is_active: true,
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn('newsletter_subscribers', 'consent_ip', {
        type: Sequelize.STRING(45),
        allowNull: true,
      }, { transaction });
      await queryInterface.addColumn('newsletter_subscribers', 'consent_user_agent', {
        type: Sequelize.STRING(255),
        allowNull: true,
      }, { transaction });

      const [existing] = await queryInterface.sequelize.query(
        'SELECT id FROM notification_templates WHERE name = :name AND channel = :channel',
        { replacements: { name: confirmTemplate.name, channel: confirmTemplate.channel }, transaction },
      );
      if (!existing.length) {
        await queryInterface.bulkInsert('notification_templates', [{
          ...confirmTemplate,
          created_at: new Date(),
          updated_at: new Date(),
        }], { transaction });
      }
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Retain the template: it may predate this migration or have been edited
      // by an administrator. There is no durable ownership record that makes
      // deletion safe, and an unused template is harmless after rollback.
      await queryInterface.removeColumn('newsletter_subscribers', 'consent_user_agent', { transaction });
      await queryInterface.removeColumn('newsletter_subscribers', 'consent_ip', { transaction });
    });
  },
};
