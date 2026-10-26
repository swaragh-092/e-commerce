'use strict';

const { QueryTypes } = require('sequelize');
const crypto = require('crypto');

module.exports = {
  async up(queryInterface) {
    const permissions = await queryInterface.sequelize.query(
      'SELECT id FROM permissions WHERE key = :key LIMIT 1',
      { type: QueryTypes.SELECT, replacements: { key: 'account.self' } }
    );
    const permissionId = permissions[0]?.id;
    if (!permissionId) return;

    const roles = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE slug = 'admin' AND is_system = TRUE LIMIT 1",
      { type: QueryTypes.SELECT }
    );
    const roleId = roles[0]?.id;
    if (!roleId) return;

    const existing = await queryInterface.sequelize.query(
      'SELECT id FROM role_permissions WHERE role_id = :roleId AND permission_id = :permissionId LIMIT 1',
      { type: QueryTypes.SELECT, replacements: { roleId, permissionId } }
    );
    if (existing.length) return;

    const now = new Date();
    await queryInterface.bulkInsert('role_permissions', [{
      id: crypto.randomUUID(),
      role_id: roleId,
      permission_id: permissionId,
      created_at: now,
      updated_at: now,
    }]);
  },

  // Preserve the grant on rollback; removing it could revoke access explicitly
  // used or extended after this compatibility migration ran.
  async down() {},
};
