'use strict';

const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const { PERMISSIONS } = require('../src/config/permissions');
const { ROLES } = require('../src/config/constants');

const now = new Date();

module.exports = {
  async up(queryInterface) {
    const permKey = PERMISSIONS.NOTIFICATIONS_MANAGE; // 'notifications.manage'

    // Insert permission if it doesn't already exist
    const existing = await queryInterface.sequelize.query(
      'SELECT id FROM permissions WHERE key = :key LIMIT 1',
      { type: QueryTypes.SELECT, replacements: { key: permKey } }
    );

    let permId = existing[0]?.id;
    if (!permId) {
      permId = crypto.randomUUID();
      await queryInterface.bulkInsert('permissions', [{
        id: permId,
        key: permKey,
        name: 'Notifications Manage',
        permission_group: 'notifications',
        description: 'Create, edit, and send notification email templates',
        created_at: now,
        updated_at: now,
      }]);
      console.log(`Created permission: ${permKey}`);
    } else {
      console.log(`Permission ${permKey} already exists — skipping insert.`);
    }

    // Assign to super_admin and admin roles
    const roles = await queryInterface.sequelize.query(
      'SELECT id, slug FROM roles WHERE slug IN (:slugs)',
      { type: QueryTypes.SELECT, replacements: { slugs: [ROLES.ADMIN, ROLES.SUPER_ADMIN] } }
    );

    for (const role of roles) {
      const alreadyLinked = await queryInterface.sequelize.query(
        'SELECT id FROM role_permissions WHERE role_id = :roleId AND permission_id = :permId LIMIT 1',
        { type: QueryTypes.SELECT, replacements: { roleId: role.id, permId } }
      );
      if (!alreadyLinked[0]?.id) {
        await queryInterface.bulkInsert('role_permissions', [{
          id: crypto.randomUUID(),
          role_id: role.id,
          permission_id: permId,
          created_at: now,
          updated_at: now,
        }]);
        console.log(`Assigned notifications.manage to role: ${role.slug}`);
      }
    }
  },

  async down(queryInterface) {
    const permKey = PERMISSIONS.NOTIFICATIONS_MANAGE;
    const rows = await queryInterface.sequelize.query(
      'SELECT id FROM permissions WHERE key = :key LIMIT 1',
      { type: QueryTypes.SELECT, replacements: { key: permKey } }
    );
    const permId = rows[0]?.id;
    if (permId) {
      await queryInterface.sequelize.query(
        'DELETE FROM role_permissions WHERE permission_id = :permId',
        { replacements: { permId } }
      );
      await queryInterface.sequelize.query(
        'DELETE FROM permissions WHERE id = :permId',
        { replacements: { permId } }
      );
    }
  },
};
