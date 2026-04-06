'use strict';

/**
 * Fix the settings table unique constraint.
 *
 * Before: UNIQUE(key)          — one global key, blocks same-named keys across groups
 *                                (e.g. footer.enabled vs announcement.enabled both use key='enabled')
 * After:  UNIQUE(key, group)   — keys are unique per group, which is the correct semantic
 */
module.exports = {
  async up(queryInterface) {
    // Drop old single-column unique constraint (postgres auto-names it settings_key_key).
    // IF EXISTS so a re-run on a fresh DB doesn't fail.
    await queryInterface.sequelize.query(
      'ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;'
    );

    // Also drop any unique index on key alone that may have been created instead of a named constraint.
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS settings_key_key;'
    );

    // Add the composite unique constraint.
    await queryInterface.addConstraint('settings', {
      fields: ['key', 'group'],
      type: 'unique',
      name: 'settings_key_group_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('settings', 'settings_key_group_unique');
    await queryInterface.addConstraint('settings', {
      fields: ['key'],
      type: 'unique',
      name: 'settings_key_key',
    });
  },
};
