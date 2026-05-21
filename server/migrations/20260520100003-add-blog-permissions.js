'use strict';

const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const { PERMISSIONS } = require('../src/config/permissions');
const { ROLES } = require('../src/config/constants');

const now = new Date();

const BLOG_PERMISSIONS = [
  {
    key: PERMISSIONS.BLOGS_READ,
    name: 'Blogs Read',
    permission_group: 'blogs',
    description: 'View blog posts and categories',
  },
  {
    key: PERMISSIONS.BLOGS_MANAGE,
    name: 'Blogs Manage',
    permission_group: 'blogs',
    description: 'Create, edit, and delete blog posts and categories',
  },
];

module.exports = {
  async up(queryInterface) {
    const permissionIds = {};

    for (const p of BLOG_PERMISSIONS) {
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

    const roles = await queryInterface.sequelize.query(
      'SELECT id, slug FROM roles WHERE slug IN (:slugs)',
      { type: QueryTypes.SELECT, replacements: { slugs: [ROLES.ADMIN, ROLES.SUPER_ADMIN] } }
    );

    const adminRoleId = roles.find((r) => r.slug === ROLES.ADMIN)?.id;
    const superAdminRoleId = roles.find((r) => r.slug === ROLES.SUPER_ADMIN)?.id;

    const assignments = [];
    for (const p of BLOG_PERMISSIONS) {
      if (adminRoleId) assignments.push({ roleId: adminRoleId, permissionId: permissionIds[p.key] });
      if (superAdminRoleId) assignments.push({ roleId: superAdminRoleId, permissionId: permissionIds[p.key] });
    }

    for (const a of assignments) {
      const existing = await queryInterface.sequelize.query(
        'SELECT id FROM role_permissions WHERE role_id = :roleId AND permission_id = :permissionId LIMIT 1',
        { type: QueryTypes.SELECT, replacements: { roleId: a.roleId, permissionId: a.permissionId } }
      );

      if (!existing[0]?.id) {
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
    const keys = BLOG_PERMISSIONS.map((p) => p.key);
    const permissions = await queryInterface.sequelize.query(
      'SELECT id FROM permissions WHERE key IN (:keys)',
      { type: QueryTypes.SELECT, replacements: { keys } }
    );

    const ids = permissions.map((p) => p.id);
    if (ids.length > 0) {
      await queryInterface.bulkDelete('role_permissions', { permission_id: ids });
      await queryInterface.bulkDelete('permissions', { id: ids });
    }
  },
};
