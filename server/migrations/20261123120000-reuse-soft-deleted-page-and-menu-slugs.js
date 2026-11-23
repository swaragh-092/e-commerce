'use strict';

const tables = [
  ['pages', 'idx_pages_active_slug_unique'],
  ['menus', 'idx_menus_active_slug_unique'],
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const [table] of tables) {
        const [constraints] = await queryInterface.sequelize.query(`
          SELECT c.conname AS name
          FROM pg_constraint c
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
          WHERE c.conrelid = '${table}'::regclass
            AND c.contype = 'u' AND array_length(c.conkey, 1) = 1
            AND a.attname = 'slug'
        `, { transaction });
        for (const constraint of constraints) {
          await queryInterface.removeConstraint(table, constraint.name, { transaction });
        }

        const indexes = await queryInterface.showIndex(table, { transaction });
        for (const index of indexes) {
          if (index.unique && !index.primary && index.fields.length === 1 && index.fields[0].attribute === 'slug') {
            await queryInterface.removeIndex(table, index.name, { transaction });
          }
        }
      }

      for (const [table, name] of tables) {
        await queryInterface.addIndex(table, ['slug'], {
          name,
          unique: true,
          where: { deleted_at: null },
          transaction,
        });
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const [table, name] of tables) {
        const [duplicates] = await queryInterface.sequelize.query(`
          SELECT slug FROM "${table}" GROUP BY slug HAVING COUNT(*) > 1 LIMIT 1
        `, { transaction });
        if (duplicates.length) {
          throw new Error(`Cannot restore unique ${table} slugs while archived records reuse a slug.`);
        }
        await queryInterface.removeIndex(table, name, { transaction });
        await queryInterface.addConstraint(table, {
          fields: ['slug'],
          type: 'unique',
          name: `${table}_slug_key`,
          transaction,
        });
      }
    });
  },
};
