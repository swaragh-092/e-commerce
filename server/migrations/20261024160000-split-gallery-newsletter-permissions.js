'use strict';

const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const schema = require('../../shared/authorization.json');

// Preserve effective access at the split. Settings readers retain campaign
// visibility, but subscriber emails remain limited to former notification managers.
const grants = {
  'gallery.read': ['media.read', 'media.upload', 'media.update', 'media.delete'],
  'gallery.manage': ['media.update'],
  'gallery.delete': ['media.delete'],
  'newsletter.read': ['settings.read', 'settings.manage', 'settings.advanced', 'notifications.manage'],
  'newsletter.manage': ['notifications.manage'],
  'newsletter.subscribers_read': ['notifications.manage'],
};

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const [key, sourceKeys] of Object.entries(grants)) {
        const existing = await queryInterface.sequelize.query(
          'SELECT id FROM permissions WHERE key = :key',
          { replacements: { key }, type: QueryTypes.SELECT, transaction }
        );
        // Never regrant a deliberately revoked permission on a repeated run.
        // Fresh installs already create these keys through the RBAC foundation.
        if (existing.length) continue;
        const permissionId = crypto.randomUUID();
        const now = new Date();
        await queryInterface.bulkInsert('permissions', [{
          id: permissionId, key,
          name: key.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          permission_group: key.split('.')[0],
          description: schema.permissionDescriptions[key],
          created_at: now, updated_at: now,
        }], { transaction });
        const roles = await queryInterface.sequelize.query(`
          SELECT DISTINCT r.id FROM roles r
          LEFT JOIN role_permissions rp ON rp.role_id = r.id
          LEFT JOIN permissions p ON p.id = rp.permission_id
          WHERE p.key IN (:sourceKeys)
             OR (r.slug = 'super_admin' AND r.is_system = true)
        `, { replacements: { sourceKeys }, type: QueryTypes.SELECT, transaction });
        if (roles.length) await queryInterface.bulkInsert('role_permissions', roles.map((role) => ({
          id: crypto.randomUUID(), role_id: role.id, permission_id: permissionId,
          created_at: now, updated_at: now,
        })), { transaction });
      }
    });
  },
  async down() {
    // Old permissions remain intact. Keep the new grants on rollback so a later
    // upgrade cannot reconstruct grants that an administrator explicitly revoked.
  },
};
