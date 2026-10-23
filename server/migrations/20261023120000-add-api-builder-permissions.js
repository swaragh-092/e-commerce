'use strict';

const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const { PERMISSIONS } = require('../src/config/permissions');
const { ROLES } = require('../src/config/constants');

const now = new Date();

const API_BUILDER_PERMISSIONS = [
  {
    key: PERMISSIONS.API_BUILDER_READ,
    name: 'API Builder Read',
    permission_group: 'api_builder',
    description: 'View API Builder definitions and endpoints',
  },
  {
    key: PERMISSIONS.API_BUILDER_MANAGE,
    name: 'API Builder Manage',
    permission_group: 'api_builder',
    description: 'Create, edit, and delete API Builder endpoints',
  },
];

module.exports = {
  async up(queryInterface) {
    const permissionIds = {};

    for (const p of API_BUILDER_PERMISSIONS) {
      const existing = await queryInterface.sequelize.query(
        'SELECT id FROM permissions WHERE key = :key LIMIT 1',
        { type: QueryTypes.SELECT, replacements: { key: p.key } }
      );

      let permissionId = existing[0]?.id;
      if (!permissionId) {
        permissionId = crypto.randomUUID();
        await queryInterface.bulkInsert('permissions', [{
          id: permissionId,
          key: p.key,
          name: p.name,
          permission_group: p.permission_group,
          description: p.description,
          created_at: now,
          updated_at: now,
        }]);
      }
      permissionIds[p.key] = permissionId;
    }

    const superAdminRole = await queryInterface.sequelize.query(
      'SELECT id FROM roles WHERE slug = :slug LIMIT 1',
      { type: QueryTypes.SELECT, replacements: { slug: ROLES.SUPER_ADMIN } }
    );
    const superAdminRoleId = superAdminRole[0]?.id;

    if (superAdminRoleId) {
      for (const p of API_BUILDER_PERMISSIONS) {
        const permId = permissionIds[p.key];
        const existing = await queryInterface.sequelize.query(
          'SELECT id FROM role_permissions WHERE role_id = :roleId AND permission_id = :permissionId LIMIT 1',
          { type: QueryTypes.SELECT, replacements: { roleId: superAdminRoleId, permissionId: permId } }
        );

        if (!existing[0]?.id) {
          await queryInterface.bulkInsert('role_permissions', [{
            id: crypto.randomUUID(),
            role_id: superAdminRoleId,
            permission_id: permId,
            created_at: now,
            updated_at: now,
          }]);
        }
      }
    }

    // Ensure default system 'admin' role does not have menus permissions or api_builder permissions
    // so Menu Builder and API Builder are accessible only to superadmins or explicitly granted staff
    const adminRole = await queryInterface.sequelize.query(
      'SELECT id FROM roles WHERE slug = :slug LIMIT 1',
      { type: QueryTypes.SELECT, replacements: { slug: ROLES.ADMIN } }
    );
    const adminRoleId = adminRole[0]?.id;

    if (adminRoleId) {
      const restrictedPerms = await queryInterface.sequelize.query(
        'SELECT id FROM permissions WHERE key IN (:keys)',
        { type: QueryTypes.SELECT, replacements: { keys: [PERMISSIONS.MENUS_READ, PERMISSIONS.MENUS_MANAGE, PERMISSIONS.API_BUILDER_READ, PERMISSIONS.API_BUILDER_MANAGE] } }
      );
      const restrictedIds = restrictedPerms.map((r) => r.id).filter(Boolean);
      if (restrictedIds.length > 0) {
        await queryInterface.sequelize.query(
          'DELETE FROM role_permissions WHERE role_id = :roleId AND permission_id IN (:ids)',
          { replacements: { roleId: adminRoleId, ids: restrictedIds } }
        );
      }
    }
  },

  async down(queryInterface) {
    const keys = API_BUILDER_PERMISSIONS.map((p) => p.key);
    const permissions = await queryInterface.sequelize.query(
      'SELECT id FROM permissions WHERE key IN (:keys)',
      { type: QueryTypes.SELECT, replacements: { keys } }
    );

    const ids = permissions.map((p) => p.id);
    if (ids.length > 0) {
      await queryInterface.bulkDelete('role_permissions', { permission_id: ids });
      await queryInterface.bulkDelete('permissions', { id: ids });
    }

    // Restore pre-existing menus permissions to standard admin role on rollback
    const adminRole = await queryInterface.sequelize.query(
      'SELECT id FROM roles WHERE slug = :slug LIMIT 1',
      { type: QueryTypes.SELECT, replacements: { slug: ROLES.ADMIN } }
    );
    const adminRoleId = adminRole[0]?.id;

    if (adminRoleId) {
      const menuPerms = await queryInterface.sequelize.query(
        'SELECT id FROM permissions WHERE key IN (:keys)',
        { type: QueryTypes.SELECT, replacements: { keys: [PERMISSIONS.MENUS_READ, PERMISSIONS.MENUS_MANAGE] } }
      );
      const now = new Date();
      for (const perm of menuPerms) {
        const existing = await queryInterface.sequelize.query(
          'SELECT id FROM role_permissions WHERE role_id = :roleId AND permission_id = :permissionId LIMIT 1',
          { type: QueryTypes.SELECT, replacements: { roleId: adminRoleId, permissionId: perm.id } }
        );
        if (!existing[0]?.id) {
          await queryInterface.bulkInsert('role_permissions', [{
            id: crypto.randomUUID(),
            role_id: adminRoleId,
            permission_id: perm.id,
            created_at: now,
            updated_at: now,
          }]);
        }
      }
    }
  },
};
