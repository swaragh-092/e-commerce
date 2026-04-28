'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      // Add columns to notification_templates
      await queryInterface.addColumn('notification_templates', 'body_sms', { type: Sequelize.TEXT, allowNull: true }, { transaction: t });
      await queryInterface.addColumn('notification_templates', 'body_whatsapp', { type: Sequelize.TEXT, allowNull: true }, { transaction: t });
      await queryInterface.addColumn('notification_templates', 'enable_email', { type: Sequelize.BOOLEAN, defaultValue: true }, { transaction: t });
      await queryInterface.addColumn('notification_templates', 'enable_sms', { type: Sequelize.BOOLEAN, defaultValue: false }, { transaction: t });
      await queryInterface.addColumn('notification_templates', 'enable_whatsapp', { type: Sequelize.BOOLEAN, defaultValue: false }, { transaction: t });

      // Add columns to notification_logs
      await queryInterface.addColumn('notification_logs', 'channel', { type: Sequelize.STRING(20), defaultValue: 'email' }, { transaction: t });
      await queryInterface.renameColumn('notification_logs', 'recipient_email', 'recipient', { transaction: t });
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.removeColumn('notification_templates', 'body_sms', { transaction: t });
      await queryInterface.removeColumn('notification_templates', 'body_whatsapp', { transaction: t });
      await queryInterface.removeColumn('notification_templates', 'enable_email', { transaction: t });
      await queryInterface.removeColumn('notification_templates', 'enable_sms', { transaction: t });
      await queryInterface.removeColumn('notification_templates', 'enable_whatsapp', { transaction: t });

      await queryInterface.removeColumn('notification_logs', 'channel', { transaction: t });
      await queryInterface.renameColumn('notification_logs', 'recipient', 'recipient_email', { transaction: t });
    });
  }
};
