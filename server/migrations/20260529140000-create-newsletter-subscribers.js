'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('newsletter_subscribers', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      // Drop the implicit case-sensitive unique — replaced below with a
      // functional unique index on LOWER(email) so 'Foo@x.com' and
      // 'foo@x.com' cannot coexist.
      email: { type: Sequelize.STRING(255), allowNull: false },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'active' },
      source: { type: Sequelize.STRING(50), allowNull: true, defaultValue: 'homepage' },
      subscribed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      unsubscribed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('newsletter_subscribers', ['status'], { name: 'newsletter_subscribers_status' });
    // Case-insensitive uniqueness at the DB level — service-level
    // toLowerCase() was the only safeguard before.
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX newsletter_subscribers_email_lower_uniq ON newsletter_subscribers (LOWER(email))'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS newsletter_subscribers_email_lower_uniq');
    await queryInterface.dropTable('newsletter_subscribers');
  },
};
