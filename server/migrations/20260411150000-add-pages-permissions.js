'use strict';

const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const { PERMISSIONS } = require('../src/config/permissions');
const { ROLES } = require('../src/config/constants');

const now = new Date();

module.exports = {
  async up(queryInterface) {
    const pagePermissions = [
      {
        key: PERMISSIONS.PAGES_READ,
        name: 'Pages Read',
        permission_group: 'pages',
        description: 'View the list of dynamic static pages',
      },
      {
        key: PERMISSIONS.PAGES_MANAGE,
        name: 'Pages Manage',
        permission_group: 'pages',
        description: 'Create, edit, and delete dynamic static pages',
      },
    ];

    const permissionIds = {};

    for (const p of pagePermissions) {
      const existingPermission = await queryInterface.sequelize.query(
        'SELECT id FROM permissions WHERE key = :key LIMIT 1',
        {
          type: QueryTypes.SELECT,
          replacements: { key: p.key },
        }
      );

      let permissionId = existingPermission[0]?.id;

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

    // Get role IDs
    const roles = await queryInterface.sequelize.query(
      'SELECT id, slug FROM roles WHERE slug IN (:slugs)',
      {
        type: QueryTypes.SELECT,
        replacements: { slugs: [ROLES.ADMIN, ROLES.SUPER_ADMIN] },
      }
    );

    const adminRoleId = roles.find(r => r.slug === ROLES.ADMIN)?.id;
    const superAdminRoleId = roles.find(r => r.slug === ROLES.SUPER_ADMIN)?.id;

    // Link permissions to roles
    const assignments = [];
    
    // Admin gets Read
    if (adminRoleId && permissionIds[PERMISSIONS.PAGES_READ]) {
        assignments.push({ roleId: adminRoleId, permissionId: permissionIds[PERMISSIONS.PAGES_READ] });
    }

    // Super Admin gets both
    if (superAdminRoleId) {
        if (permissionIds[PERMISSIONS.PAGES_READ]) {
            assignments.push({ roleId: superAdminRoleId, permissionId: permissionIds[PERMISSIONS.PAGES_READ] });
        }
        if (permissionIds[PERMISSIONS.PAGES_MANAGE]) {
            assignments.push({ roleId: superAdminRoleId, permissionId: permissionIds[PERMISSIONS.PAGES_MANAGE] });
        }
    }

    for (const a of assignments) {
      const existingRolePermission = await queryInterface.sequelize.query(
        'SELECT id FROM role_permissions WHERE role_id = :roleId AND permission_id = :permissionId LIMIT 1',
        {
          type: QueryTypes.SELECT,
          replacements: { roleId: a.roleId, permissionId: a.permissionId },
        }
      );

      if (!existingRolePermission[0]?.id) {
        await queryInterface.bulkInsert('role_permissions', [{
          id: crypto.randomUUID(),
          role_id: a.roleId,
          permission_id: a.permissionId,
          created_at: now,
          updated_at: now,
        }]);
      }
    }
  },

  async down(queryInterface) {
    const keys = [PERMISSIONS.PAGES_READ, PERMISSIONS.PAGES_MANAGE];
    const permissions = await queryInterface.sequelize.query(
      'SELECT id FROM permissions WHERE key IN (:keys)',
      {
        type: QueryTypes.SELECT,
        replacements: { keys },
      }
    );

    const ids = permissions.map(p => p.id);
    if (ids.length > 0) {
      await queryInterface.bulkDelete('role_permissions', { permission_id: ids });
      await queryInterface.bulkDelete('permissions', { id: ids });
    }
  },
};
