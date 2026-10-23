'use strict';

const crypto = require('crypto');
const { DEFAULTS } = require('../src/modules/notification/notification.defaults');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn('orders', 'guest_email', {
        type: Sequelize.STRING(255),
        allowNull: true,
      }, { transaction });
      await queryInterface.sequelize.query(`
        UPDATE orders
        SET guest_email = LOWER(TRIM(shipping_address_snapshot->>'email'))
        WHERE user_id IS NULL
          AND COALESCE(TRIM(shipping_address_snapshot->>'email'), '') <> ''
      `, { transaction });
      await queryInterface.addIndex('orders', ['guest_email'], {
        name: 'idx_orders_unclaimed_guest_email',
        where: { user_id: null },
        transaction,
      });
      await queryInterface.createTable('guest_order_claim_tokens', {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        token_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
        expires_at: { type: Sequelize.DATE, allowNull: false },
        used_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      }, { transaction });
      await queryInterface.addIndex('guest_order_claim_tokens', ['user_id', 'expires_at'], {
        name: 'idx_guest_order_claim_tokens_user_expiry', transaction,
      });
      const template = DEFAULTS.guest_order_claim;
      const [existing] = await queryInterface.sequelize.query(
        "SELECT id FROM notification_templates WHERE name = 'guest_order_claim' AND channel = 'email'",
        { transaction }
      );
      if (!existing.length) {
        await queryInterface.bulkInsert('notification_templates', [{
          id: crypto.randomUUID(),
          name: 'guest_order_claim', channel: 'email', subject: template.subject,
          body_html: template.bodyHtml, body_text: template.bodyText, is_active: true,
          created_at: new Date(), updated_at: new Date(),
        }], { transaction });
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete('notification_templates', { name: 'guest_order_claim', channel: 'email' }, { transaction });
      await queryInterface.dropTable('guest_order_claim_tokens', { transaction });
      await queryInterface.removeIndex('orders', 'idx_orders_unclaimed_guest_email', { transaction });
      await queryInterface.removeColumn('orders', 'guest_email', { transaction });
    });
  },
};
