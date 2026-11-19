import { createRequire } from 'node:module';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const { Sequelize, QueryTypes } = require('sequelize');
const db = require('../../src/modules');
const migration = require('../../migrations/20261102090000-add-shared-security-state');
const Store = require('../../src/utils/postgresRateLimitStore');
const attempts = require('../../src/modules/auth/loginAttemptStore');

// Run only against an explicitly supplied disposable database, never the app DB.
describe.skipIf(!process.env.AUDIT_TEST_DATABASE_URL)('Shared security state in PostgreSQL', () => {
  let connection;
  beforeAll(async () => {
    connection = new Sequelize(process.env.AUDIT_TEST_DATABASE_URL, { logging: false });
    await connection.query('CREATE TABLE notification_queue (dedupe_key TEXT, status TEXT)');
    await migration.up(connection.getQueryInterface(), Sequelize);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    if (!connection) return;
    await migration.down(connection.getQueryInterface());
    await connection.query('DROP TABLE notification_queue');
    await connection.close();
  });
  const useDatabase = () => vi.spyOn(db.sequelize, 'query').mockImplementation((...args) => connection.query(...args));

  it('shares atomic increments and the original expiry across store instances', async () => {
    useDatabase();
    const first = new Store('concurrent');
    const second = new Store('concurrent');
    first.init({ windowMs: 60000 }); second.init({ windowMs: 60000 });
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? first : second).increment('test-client')));
    expect(results.map((result) => result.totalHits).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(new Set(results.map((result) => result.resetTime.getTime())).size).toBe(1);
    const [row] = await connection.query('SELECT window_start, expires_at FROM rate_limit_windows', { type: QueryTypes.SELECT });
    expect(new Date(row.expires_at) - new Date(row.window_start)).toBe(60000);
    await first.decrement('test-client');
    expect((await second.increment('test-client')).totalHits).toBe(20);
    await second.resetKey('test-client');
    expect((await first.increment('test-client')).totalHits).toBe(1);
  });

  it('resets only expired windows and isolates limiter prefixes', async () => {
    useDatabase();
    const first = new Store('expiry'); const other = new Store('other');
    await first.increment('client'); await other.increment('client');
    await connection.query("UPDATE rate_limit_windows SET expires_at = NOW() - INTERVAL '1 second' WHERE limiter_key = :key", { replacements: { key: first.makeKey('client') } });
    expect((await first.increment('client')).totalHits).toBe(1);
    expect((await other.increment('client')).totalHits).toBe(2);
    await first.resetAll();
    expect((await other.increment('client')).totalHits).toBe(3);
  });

  it('locks an account across concurrent failures and clears it after successful login', async () => {
    useDatabase();
    await Promise.all(Array.from({ length: 5 }, () => attempts.recordFailure('Person@Example.test')));
    await expect(attempts.checkLock('person@example.test')).rejects.toMatchObject({ statusCode: 429 });
    await attempts.clear('person@example.test');
    await expect(attempts.checkLock('Person@Example.test')).resolves.toBeUndefined();
  });

  it('lets exactly one concurrent email claim through and separates message kinds', async () => {
    useDatabase();
    const results = await Promise.all(Array.from({ length: 12 }, () => attempts.claimEmailSend('forgot', 'target@example.test')));
    expect(results.filter((throttled) => !throttled)).toHaveLength(1);
    expect(await attempts.claimEmailSend('resend', 'target@example.test')).toBe(false);
    const rows = await connection.query('SELECT email_hash FROM auth_email_throttles', { type: QueryTypes.SELECT });
    expect(rows.every((row) => /^[a-f0-9]{64}$/.test(row.email_hash))).toBe(true);
  });
});
