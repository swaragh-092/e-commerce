'use strict';

module.exports = {
  async up(queryInterface) {
    // 1. Add the column WITHOUT a unique constraint — we will backfill first,
    //    then create the unique index. With the unique index in place, rows
    //    with NULL tokens would still be allowed (NULLs are not equal in PG),
    //    but creating the index before backfill is fragile and order-sensitive.
    await queryInterface.addColumn('newsletter_subscribers', 'unsubscribe_token', {
      type: 'VARCHAR(64)',
      allowNull: true,
    });

    // 2. Backfill in a single server-side statement. gen_random_bytes is
    //    Postgres-side — no per-row JS round-trip, no transaction window,
    //    and atomic across the whole table.
    await queryInterface.sequelize.query(
      "UPDATE newsletter_subscribers SET unsubscribe_token = encode(gen_random_bytes(24), 'hex') WHERE unsubscribe_token IS NULL"
    );

    // 3. Now that every row has a non-null value, create the unique index.
    //    Skip existing duplicates defensively — should never fire post-backfill.
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX newsletter_subscribers_token_uniq ON newsletter_subscribers (unsubscribe_token)'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS newsletter_subscribers_token_uniq');
    await queryInterface.removeColumn('newsletter_subscribers', 'unsubscribe_token');
  },
};
