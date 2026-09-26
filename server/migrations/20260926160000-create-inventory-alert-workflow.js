'use strict';

const { DEFAULTS } = require('../src/modules/notification/notification.defaults');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inventory_alerts', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      inventory_key: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      product_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'products', key: 'id' }, onDelete: 'CASCADE' },
      variant_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'product_variants', key: 'id' }, onDelete: 'SET NULL' },
      severity: { type: Sequelize.STRING(20), allowNull: false },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'open' },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      reserved_qty: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      available_qty: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      threshold: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 10 },
      first_detected_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      last_detected_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      last_notified_at: { type: Sequelize.DATE, allowNull: true },
      resolved_at: { type: Sequelize.DATE, allowNull: true },
      assigned_to: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      acknowledged_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      acknowledged_at: { type: Sequelize.DATE, allowNull: true },
      note: { type: Sequelize.STRING(1000), allowNull: false, defaultValue: '' },
      expected_restock_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('inventory_alerts', ['status', 'severity'], { name: 'idx_inventory_alerts_status_severity' });
    await queryInterface.addIndex('inventory_alerts', ['assigned_to'], { name: 'idx_inventory_alerts_assigned_to' });
    await queryInterface.addIndex('inventory_alerts', ['product_id'], { name: 'idx_inventory_alerts_product_id' });
    await queryInterface.addIndex('inventory_alerts', ['variant_id'], { name: 'idx_inventory_alerts_variant_id' });

    await queryInterface.createTable('inventory_alert_configs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      config_key: { type: Sequelize.STRING(40), allowNull: false, unique: true, defaultValue: 'store' },
      recipient_user_ids: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      timezone: { type: Sequelize.STRING(80), allowNull: false, defaultValue: 'Asia/Kolkata' },
      digest_hour: { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 9 },
      reminder_interval_days: { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 1 },
      immediate_out_of_stock: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      include_environment_recipients: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      updated_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.sequelize.query(`
      INSERT INTO inventory_alert_configs (id, config_key, recipient_user_ids, timezone, digest_hour, reminder_interval_days, immediate_out_of_stock, include_environment_recipients, created_at, updated_at)
      VALUES (gen_random_uuid(), 'store', '[]'::jsonb, 'Asia/Kolkata', 9, 1, true, false, NOW(), NOW())
      ON CONFLICT (config_key) DO NOTHING
    `);

    await queryInterface.addColumn('notification_queue', 'dedupe_key', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addIndex('notification_queue', ['dedupe_key'], {
      unique: true,
      name: 'uq_notification_queue_dedupe_key',
    });

    const template = DEFAULTS.inventory_alert_digest;
    await queryInterface.sequelize.query(`
      INSERT INTO notification_templates (id, name, channel, subject, body_html, body_text, is_active, created_at, updated_at)
      VALUES (gen_random_uuid(), 'inventory_alert_digest', 'email', :subject, :bodyHtml, :bodyText, true, NOW(), NOW())
      ON CONFLICT (name, channel) DO NOTHING
    `, { replacements: template });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('notification_queue', 'uq_notification_queue_dedupe_key');
    await queryInterface.removeColumn('notification_queue', 'dedupe_key');
    await queryInterface.dropTable('inventory_alert_configs');
    await queryInterface.dropTable('inventory_alerts');
    // Keep the notification template on rollback because an administrator may have edited it.
  },
};
