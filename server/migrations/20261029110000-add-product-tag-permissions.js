'use strict';

const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const schema = require('../../shared/authorization.json');

const tagPermissions = ['tags.read', 'tags.manage'];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const ids = {};
      for (const key of tagPermissions) {
        const existing = await queryInterface.sequelize.query(
          'SELECT id FROM permissions WHERE key = :key LIMIT 1',
          { replacements: { key }, type: QueryTypes.SELECT, transaction }
        );
        if (existing[0]?.id) {
          ids[key] = existing[0].id;
          continue;
        }
        const id = crypto.randomUUID();
        const now = new Date();
        await queryInterface.bulkInsert('permissions', [{
          id,
          key,
          name: key.replace(/[._]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
          permission_group: 'tags',
          description: schema.permissionDescriptions[key],
          created_at: now,
          updated_at: now,
        }], { transaction });
        ids[key] = id;
      }

      // Existing staff admins keep access after the new controls are introduced.
      // Custom roles can then be narrowed through Access Control.
      const roles = await queryInterface.sequelize.query(
        "SELECT id FROM roles WHERE slug IN ('admin', 'super_admin')",
        { type: QueryTypes.SELECT, transaction }
      );
      const now = new Date();
      for (const role of roles) {
        for (const key of tagPermissions) {
          const existing = await queryInterface.sequelize.query(
            'SELECT id FROM role_permissions WHERE role_id = :roleId AND permission_id = :permissionId LIMIT 1',
            { replacements: { roleId: role.id, permissionId: ids[key] }, type: QueryTypes.SELECT, transaction }
          );
          if (!existing[0]) {
            await queryInterface.bulkInsert('role_permissions', [{
              id: crypto.randomUUID(),
              role_id: role.id,
              permission_id: ids[key],
              created_at: now,
              updated_at: now,
            }], { transaction });
          }
        }
      }
    });
  },

  async down() {
    // Preserve role assignments and grants to avoid restoring revoked access
    // on a later migration run.
  },
};
