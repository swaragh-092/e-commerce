'use strict';

const crypto = require('crypto');
const { QueryTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const users = await queryInterface.sequelize.query(
      `SELECT u.id AS user_id, r.id AS role_id
       FROM users u
       JOIN roles r ON r.slug = u.role AND r.is_active = TRUE
       WHERE u.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
         )`,
      { type: QueryTypes.SELECT }
    );

    if (users.length === 0) return;

    const now = new Date();
    await queryInterface.bulkInsert('user_roles', users.map(({ user_id, role_id }) => ({
      id: crypto.randomUUID(),
      user_id,
      role_id,
      created_at: now,
      updated_at: now,
    })));
  },

  // Keep assignments on rollback: removing role links could revoke access
  // granted after this data repair was applied.
  async down() {},
};
