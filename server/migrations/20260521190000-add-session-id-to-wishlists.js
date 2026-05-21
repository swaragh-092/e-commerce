'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [sessionIdColumns] = await queryInterface.sequelize.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'wishlists'
        AND column_name = 'session_id'
      LIMIT 1;
    `);

    if (!sessionIdColumns.length) {
      await queryInterface.addColumn('wishlists', 'session_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }

    await queryInterface.changeColumn('wishlists', 'user_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE wishlists
      DROP CONSTRAINT IF EXISTS wishlists_user_id_key;
    `);

    await queryInterface.sequelize.query('DROP INDEX IF EXISTS wishlists_user_id_key;');

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

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE wishlists
      DROP CONSTRAINT IF EXISTS chk_wishlist_owner;
    `);

    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uniq_wishlists_session_id_not_null;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uniq_wishlists_user_id_not_null;');

    const [sessionIdColumns] = await queryInterface.sequelize.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'wishlists'
        AND column_name = 'session_id'
      LIMIT 1;
    `);

    if (sessionIdColumns.length) {
      await queryInterface.removeColumn('wishlists', 'session_id');
    }

    await queryInterface.changeColumn('wishlists', 'user_id', {
      type: Sequelize.UUID,
      allowNull: false,
      unique: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    });
  },
};
