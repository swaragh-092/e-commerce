import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const migration = require('../../migrations/20261024160000-split-gallery-newsletter-permissions');
function fixture() {
  const permissions = new Map();
  const roles = [
    { id: 'empty', keys: [] }, { id: 'reader', keys: ['settings.read'] },
    { id: 'media', keys: ['media.update'] }, { id: 'sender', keys: ['notifications.manage'] },
    { id: 'super', keys: [], super: true },
  ];
  const links = [];
  const qi = { sequelize: {
    transaction: vi.fn(async (callback) => callback({})),
    query: vi.fn(async (sql, { replacements }) => {
      if (sql.includes('SELECT id FROM permissions')) return permissions.has(replacements.key) ? [{ id: permissions.get(replacements.key) }] : [];
      return roles.filter((r) => r.super || r.keys.some((key) => replacements.sourceKeys.includes(key))).map(({ id }) => ({ id }));
    }),
  }, bulkInsert: vi.fn(async (table, rows) => {
    if (table === 'permissions') rows.forEach((row) => permissions.set(row.key, row.id));
    else links.push(...rows);
  }) };
  return { qi, permissions, links };
}
describe('Feature permission migration', () => {
  it('preserves prior capabilities without granting subscriber emails to settings readers or access to empty roles', async () => {
    const { qi, permissions, links } = fixture(); await migration.up(qi);
    const keysFor = (id) => [...permissions].filter(([, pid]) => links.some((l) => l.role_id === id && l.permission_id === pid)).map(([key]) => key);
    expect(keysFor('empty')).toEqual([]);
    expect(keysFor('reader')).toEqual(['newsletter.read']);
    expect(keysFor('media')).toEqual(['gallery.read', 'gallery.manage']);
    expect(keysFor('sender')).toEqual(['newsletter.read', 'newsletter.manage', 'newsletter.subscribers_read']);
    expect(keysFor('super')).toHaveLength(6);
  });
  it('does not restore revoked grants on rerun or rollback and re-upgrade', async () => {
    const { qi, links } = fixture(); await migration.up(qi); links.length = 0;
    await migration.down(qi); await migration.up(qi); expect(links).toEqual([]);
  });
});
