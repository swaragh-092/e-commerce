'use strict';

const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const { PERMISSIONS } = require('../src/config/permissions');

const MEDIA_UPDATE = PERMISSIONS.MEDIA_UPDATE;

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    let permission = await queryInterface.sequelize.query(
      'SELECT id FROM permissions WHERE key = :key LIMIT 1',
      {
        replacements: { key: MEDIA_UPDATE },
        type: QueryTypes.SELECT,
      }
    );

    if (!permission[0]) {
      await queryInterface.bulkInsert('permissions', [{
        id: crypto.randomUUID(),
        key: MEDIA_UPDATE,
        name: 'Media Update',
        permission_group: 'media',
        description: 'Update media metadata',
        created_at: now,
        updated_at: now,
      }]);

      permission = await queryInterface.sequelize.query(
        'SELECT id FROM permissions WHERE key = :key LIMIT 1',
        {
          replacements: { key: MEDIA_UPDATE },
          type: QueryTypes.SELECT,
        }
      );
    }

    const permissionId = permission[0]?.id;
    if (!permissionId) return;

    const roles = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE slug IN ('admin', 'super_admin')",
      { type: QueryTypes.SELECT }
    );

    for (const role of roles) {
      const existing = await queryInterface.sequelize.query(
        'SELECT id FROM role_permissions WHERE role_id = :roleId AND permission_id = :permissionId LIMIT 1',
        {
          replacements: { roleId: role.id, permissionId },
          type: QueryTypes.SELECT,
        }
      );

      if (!existing[0]) {
        await queryInterface.bulkInsert('role_permissions', [{
          id: crypto.randomUUID(),
          role_id: role.id,
          permission_id: permissionId,
          created_at: now,
          updated_at: now,
        }]);
      }
    }
  },

  async down(queryInterface) {
    const permission = await queryInterface.sequelize.query(
      'SELECT id FROM permissions WHERE key = :key LIMIT 1',
      {
        replacements: { key: MEDIA_UPDATE },
        type: QueryTypes.SELECT,
      }
    );

    const permissionId = permission[0]?.id;
    if (!permissionId) return;

    await queryInterface.sequelize.query(
      "DELETE FROM role_permissions WHERE permission_id = :permissionId AND role_id IN (SELECT id FROM roles WHERE slug IN ('admin', 'super_admin'))",
      { replacements: { permissionId } }
    );
  },
};
