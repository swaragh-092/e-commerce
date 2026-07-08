'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    const [cols] = await queryInterface.sequelize.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'newsletter_subscribers' AND column_name = 'unsubscribe_token'"
    );

    if (cols.length === 0) {
      await queryInterface.addColumn('newsletter_subscribers', 'unsubscribe_token', {
        type: 'VARCHAR(64)',
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(
      "UPDATE newsletter_subscribers SET unsubscribe_token = encode(gen_random_bytes(24), 'hex') WHERE unsubscribe_token IS NULL"
    );

    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_token_uniq ON newsletter_subscribers (unsubscribe_token)'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS newsletter_subscribers_token_uniq');
    await queryInterface.removeColumn('newsletter_subscribers', 'unsubscribe_token');
  },
};
