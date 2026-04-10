'use strict';

const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const { PERMISSIONS } = require('../src/config/permissions');
const { ROLES } = require('../src/config/constants');

const now = new Date();

module.exports = {
  async up(queryInterface) {
    const existingPermission = await queryInterface.sequelize.query(
      'SELECT id FROM permissions WHERE key = :key LIMIT 1',
      {
        type: QueryTypes.SELECT,
        replacements: { key: PERMISSIONS.SYSTEM_ROLES_MANAGE },
      }
    );

    let permissionId = existingPermission[0]?.id;

    if (!permissionId) {
      permissionId = crypto.randomUUID();
      await queryInterface.bulkInsert('permissions', [{
        id: permissionId,
        key: PERMISSIONS.SYSTEM_ROLES_MANAGE,
        name: 'System Roles Manage',
        permission_group: 'system_roles',
        description: 'Edit protected system roles and their permissions',
        created_at: now,
        updated_at: now,
      }]);
    }

    const superAdminRole = await queryInterface.sequelize.query(
      'SELECT id FROM roles WHERE slug = :slug LIMIT 1',
      {
        type: QueryTypes.SELECT,
        replacements: { slug: ROLES.SUPER_ADMIN },
      }
    );

    const superAdminRoleId = superAdminRole[0]?.id;
    if (!superAdminRoleId) {
      return;
    }

    const existingRolePermission = await queryInterface.sequelize.query(
      'SELECT id FROM role_permissions WHERE role_id = :roleId AND permission_id = :permissionId LIMIT 1',
      {
        type: QueryTypes.SELECT,
        replacements: { roleId: superAdminRoleId, permissionId },
      }
    );

    if (!existingRolePermission[0]?.id) {
      await queryInterface.bulkInsert('role_permissions', [{
        id: crypto.randomUUID(),
        role_id: superAdminRoleId,
        permission_id: permissionId,
        created_at: now,
        updated_at: now,
      }]);
    }
  },

  async down(queryInterface) {
    const permission = await queryInterface.sequelize.query(
      'SELECT id FROM permissions WHERE key = :key LIMIT 1',
      {
        type: QueryTypes.SELECT,
        replacements: { key: PERMISSIONS.SYSTEM_ROLES_MANAGE },
      }
    );

    const permissionId = permission[0]?.id;
    if (!permissionId) {
      return;
    }

    await queryInterface.bulkDelete('role_permissions', { permission_id: permissionId });
    await queryInterface.bulkDelete('permissions', { id: permissionId });
  },
};