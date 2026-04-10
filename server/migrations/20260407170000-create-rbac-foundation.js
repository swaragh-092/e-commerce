'use strict';

const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const { ROLES } = require('../src/config/constants');
const {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SYSTEM_ROLE_DEFINITIONS,
} = require('../src/config/permissions');

const now = new Date();

const humanize = (value) =>
  String(value)
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('roles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      name: { type: Sequelize.STRING(100), allowNull: false },
      slug: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      description: { type: Sequelize.STRING(255), allowNull: true },
      base_role: { type: Sequelize.STRING(20), allowNull: false, defaultValue: ROLES.ADMIN },
      is_system: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    await queryInterface.createTable('permissions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      key: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(120), allowNull: false },
      permission_group: { type: Sequelize.STRING(60), allowNull: false },
      description: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    await queryInterface.createTable('role_permissions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      role_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'roles', key: 'id' },
        onDelete: 'CASCADE',
      },
      permission_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'permissions', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    await queryInterface.createTable('user_roles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      role_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'roles', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    await queryInterface.addIndex('roles', ['slug'], { unique: true, name: 'idx_roles_slug' });
    await queryInterface.addIndex('permissions', ['key'], { unique: true, name: 'idx_permissions_key' });
    await queryInterface.addIndex('role_permissions', ['role_id', 'permission_id'], { unique: true, name: 'idx_role_permissions_unique' });
    await queryInterface.addIndex('user_roles', ['user_id', 'role_id'], { unique: true, name: 'idx_user_roles_unique' });

    const permissionRows = Object.values(PERMISSIONS).map((permissionKey) => ({
      id: crypto.randomUUID(),
      key: permissionKey,
      name: humanize(permissionKey),
      permission_group: permissionKey.split('.')[0],
      description: `${humanize(permissionKey)} permission`,
      created_at: now,
      updated_at: now,
    }));

    await queryInterface.bulkInsert('permissions', permissionRows);
    const permissionIdByKey = Object.fromEntries(permissionRows.map((permission) => [permission.key, permission.id]));

    const roleRows = Object.entries(SYSTEM_ROLE_DEFINITIONS).map(([slug, definition]) => ({
      id: crypto.randomUUID(),
      name: definition.name,
      slug,
      description: definition.description,
      base_role: slug,
      is_system: true,
      is_active: true,
      created_at: now,
      updated_at: now,
    }));

    await queryInterface.bulkInsert('roles', roleRows);
    const roleIdBySlug = Object.fromEntries(roleRows.map((role) => [role.slug, role.id]));

    const rolePermissionRows = Object.entries(ROLE_PERMISSIONS).flatMap(([roleSlug, permissionKeys]) =>
      permissionKeys.map((permissionKey) => ({
        id: crypto.randomUUID(),
        role_id: roleIdBySlug[roleSlug],
        permission_id: permissionIdByKey[permissionKey],
        created_at: now,
        updated_at: now,
      }))
    );

    await queryInterface.bulkInsert('role_permissions', rolePermissionRows);

    const users = await queryInterface.sequelize.query(
      'SELECT id, role FROM users WHERE deleted_at IS NULL',
      { type: QueryTypes.SELECT }
    );

    if (users.length) {
      const userRoleRows = users
        .filter((user) => roleIdBySlug[user.role])
        .map((user) => ({
          id: crypto.randomUUID(),
          user_id: user.id,
          role_id: roleIdBySlug[user.role],
          created_at: now,
          updated_at: now,
        }));

      if (userRoleRows.length) {
        await queryInterface.bulkInsert('user_roles', userRoleRows);
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_roles');
    await queryInterface.dropTable('role_permissions');
    await queryInterface.dropTable('permissions');
    await queryInterface.dropTable('roles');
  },
};