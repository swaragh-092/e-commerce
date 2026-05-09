'use strict';

const { DEFAULTS } = require('../src/modules/notification/notification.defaults');

const smsBodyFor = (name, defaults) => defaults.bodyText || defaults.subject || name;

const whatsappBodyFor = (name, defaults) => {
  const body = defaults.bodyText || defaults.subject || name;
  return `${body}\n\n- {{store_name}}`;
};

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('notification_queue')) {
      await queryInterface.createTable('notification_queue', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
        template_name: { type: Sequelize.STRING(100), allowNull: false },
        channel: { type: Sequelize.STRING(20), allowNull: false },
        recipient_email: { type: Sequelize.STRING(255), allowNull: true },
        recipient_phone: { type: Sequelize.STRING(30), allowNull: true },
        variables: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'queued' },
        attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        max_attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
        next_attempt_at: { type: Sequelize.DATE, allowNull: true },
        locked_at: { type: Sequelize.DATE, allowNull: true },
        sent_at: { type: Sequelize.DATE, allowNull: true },
        error: { type: Sequelize.TEXT, allowNull: true },
        user_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
        order_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'orders', key: 'id' }, onDelete: 'SET NULL' },
        created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      });

      await queryInterface.addIndex('notification_queue', ['status', 'next_attempt_at'], { name: 'idx_notification_queue_status_next' });
      await queryInterface.addIndex('notification_queue', ['channel'], { name: 'idx_notification_queue_channel' });
      await queryInterface.addIndex('notification_queue', ['created_at'], { name: 'idx_notification_queue_created' });
    }

    const now = new Date();
    const rows = [];
    Object.entries(DEFAULTS).forEach(([name, defaults]) => {
      rows.push({
        name,
        channel: 'email',
        subject: defaults.subject || name,
        body_html: defaults.bodyHtml || '',
        body_text: defaults.bodyText || '',
        is_active: true,
        created_at: now,
        updated_at: now,
      });
      rows.push({
        name,
        channel: 'sms',
        subject: defaults.subject || name,
        body_html: '',
        body_text: smsBodyFor(name, defaults),
        is_active: false,
        created_at: now,
        updated_at: now,
      });
      rows.push({
        name,
        channel: 'whatsapp',
        subject: defaults.subject || name,
        body_html: '',
        body_text: whatsappBodyFor(name, defaults),
        is_active: false,
        created_at: now,
        updated_at: now,
      });
    });

    for (const row of rows) {
      await queryInterface.sequelize.query(
        `INSERT INTO notification_templates
          (id, name, channel, subject, body_html, body_text, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), :name, :channel, :subject, :body_html, :body_text, :is_active, NOW(), NOW())
         ON CONFLICT (name, channel) DO NOTHING`,
        { replacements: row }
      );
    }
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('notification_templates', {
      name: Object.keys(DEFAULTS),
      channel: ['sms', 'whatsapp'],
    });
    await queryInterface.dropTable('notification_queue');
  },
};
