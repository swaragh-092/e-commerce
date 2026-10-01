'use strict';

/**
 * Enforce phone uniqueness on user_profiles (app-level checks are raceable).
 * Pre-migration: duplicate non-null phones keep the earliest row; the rest
 * are nulled so the constraint can be applied without data loss.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      const [existing] = await queryInterface.sequelize.query(`
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'user_profiles_phone_unique'
          AND n.nspname = CURRENT_SCHEMA()
        LIMIT 1;
      `);
      if (existing && existing.length > 0) {
        return; // user_profiles_phone_unique already exists (e.g. from 20260521120000)
      }
    }

    // Null out duplicate phones, keeping the earliest-created row per number.
    await queryInterface.sequelize.query(`
      UPDATE user_profiles p SET phone = NULL
      WHERE p.phone IS NOT NULL AND p.id NOT IN (
        SELECT DISTINCT ON (phone) id FROM user_profiles
        WHERE phone IS NOT NULL ORDER BY phone, created_at ASC, id ASC
      );
    `);
    await queryInterface.addConstraint('user_profiles', {
      fields: ['phone'],
      type: 'unique',
      name: 'user_profiles_phone_unique',
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeConstraint('user_profiles', 'user_profiles_phone_unique');
    } catch {
      // Constraint may not exist or may have been managed as an index
    }
  },
};
