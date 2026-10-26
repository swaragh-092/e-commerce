import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const migration = require('../../migrations/20261024170000-backfill-admin-account-self-permission');

function fixture({ hasPermission = true, hasAdminRole = true, hasGrant = false } = {}) {
  const inserted = [];
  let grantExists = hasGrant;
  const sequelize = {
    query: vi.fn(async (sql) => {
      if (sql.includes('FROM permissions')) return hasPermission ? [{ id: 'account-self' }] : [];
      if (sql.includes('FROM roles')) return hasAdminRole ? [{ id: 'admin-role' }] : [];
      if (sql.includes('FROM role_permissions')) return grantExists ? [{ id: 'existing-link' }] : [];
      return [];
    }),
  };
  return { queryInterface: { sequelize, bulkInsert: vi.fn(async (_table, rows) => { inserted.push(...rows); grantExists = true; }) }, inserted };
}

describe('Admin account.self compatibility migration', () => {
  it('grants account.self to the existing system Admin role once', async () => {
    const { queryInterface, inserted } = fixture();
    await migration.up(queryInterface);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ role_id: 'admin-role', permission_id: 'account-self' });
    await migration.up(queryInterface);
    expect(inserted).toHaveLength(1);
  });

  it('does not recreate missing permission or role rows', async () => {
    for (const options of [{ hasPermission: false }, { hasAdminRole: false }]) {
      const { queryInterface, inserted } = fixture(options);
      await migration.up(queryInterface);
      expect(inserted).toEqual([]);
      expect(queryInterface.bulkInsert).not.toHaveBeenCalled();
    }
  });

  it('does not restore an existing grant or remove it on rollback', async () => {
    const { queryInterface, inserted } = fixture({ hasGrant: true });
    await migration.up(queryInterface);
    await migration.down(queryInterface);
    expect(inserted).toEqual([]);
    expect(queryInterface.bulkInsert).not.toHaveBeenCalled();
  });
});
