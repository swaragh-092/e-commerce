'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rate_limit_windows', {
      limiter_key: { type: Sequelize.STRING(128), primaryKey: true, allowNull: false },
      window_start: { type: Sequelize.DATE, allowNull: false },
      hits: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      expires_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('rate_limit_windows', ['expires_at'], {
      name: 'rate_limit_windows_expires_at_idx',
    });

    await queryInterface.createTable('auth_login_attempts', {
      email_hash: { type: Sequelize.STRING(64), primaryKey: true, allowNull: false },
      failure_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      window_started_at: { type: Sequelize.DATE, allowNull: false },
      locked_until: { type: Sequelize.DATE, allowNull: true },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('auth_login_attempts', ['updated_at'], {
      name: 'auth_login_attempts_updated_at_idx',
    });

    await queryInterface.createTable('auth_email_throttles', {
      email_hash: { type: Sequelize.STRING(64), primaryKey: true, allowNull: false },
      last_sent_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('auth_email_throttles', ['last_sent_at'], {
      name: 'auth_email_throttles_last_sent_at_idx',
    });

    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS notification_queue_newsletter_campaign_status_idx
      ON notification_queue (split_part(dedupe_key, ':', 2), status)
      WHERE dedupe_key LIKE 'newsletter:%'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS notification_queue_newsletter_campaign_status_idx');
    await queryInterface.dropTable('auth_email_throttles');
    await queryInterface.dropTable('auth_login_attempts');
    await queryInterface.dropTable('rate_limit_windows');
  },
};
