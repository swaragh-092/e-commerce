'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE wishlists
      ALTER COLUMN user_id DROP NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE wishlists
      DROP CONSTRAINT IF EXISTS wishlists_user_id_key;
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_wishlists_user_id_not_null
      ON wishlists (user_id)
      WHERE user_id IS NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_wishlists_session_id_not_null
      ON wishlists (session_id)
      WHERE session_id IS NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'chk_wishlist_owner'
        ) THEN
          ALTER TABLE wishlists
          ADD CONSTRAINT chk_wishlist_owner
          CHECK (user_id IS NOT NULL OR session_id IS NOT NULL);
        END IF;
      END $$;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE wishlists
      DROP CONSTRAINT IF EXISTS chk_wishlist_owner;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS uniq_wishlists_session_id_not_null;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS uniq_wishlists_user_id_not_null;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE wishlists
      ALTER COLUMN user_id SET NOT NULL;
    `);
  },
};
