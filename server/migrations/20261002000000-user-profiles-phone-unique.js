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
    await queryInterface.removeConstraint('user_profiles', 'user_profiles_phone_unique');
  },
};
