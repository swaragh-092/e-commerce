import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
process.env.JWT_ACCESS_SECRET = 'test-access-secret-32chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-long!';
const db = require('../../src/modules');
const auth = require('../../src/modules/auth/auth.service');
const otp = require('../../src/modules/auth/otp.service');
const { generateTokens } = require('../../src/modules/auth/tokenUtils');
const features = require('../../src/middleware/featureGate.middleware');
const LoginAttemptStore = require('../../src/modules/auth/loginAttemptStore');
beforeEach(() => vi.spyOn(db.Setting, 'findOne').mockResolvedValue(null));
afterEach(() => vi.restoreAllMocks());

describe('Authentication security regressions', () => {
  it('commits reuse revocation before rejecting the replay', async () => {
    let committed = false;
    vi.spyOn(db.User, 'findByPk').mockResolvedValue({ id: 'u', role: 'customer', status: 'active' });
    vi.spyOn(features, 'getResolvedFeature').mockResolvedValue(false);
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (_options, callback) => {
      const result = await callback({ LOCK: { UPDATE: 'UPDATE' } });
      committed = true;
      return result;
    });
    vi.spyOn(db.RefreshToken, 'findOne').mockResolvedValue({ id: 'old', userId: 'u', revokedAt: new Date(), replacedByTokenId: 'current', expiresAt: new Date(Date.now() + 60000) });
    vi.spyOn(db.RefreshToken, 'findAll').mockResolvedValue([{ id: 'current' }]);
    vi.spyOn(db.RefreshToken, 'findByPk').mockResolvedValue({ id: 'current', userId: 'u', revokedAt: null });
    const update = vi.spyOn(db.RefreshToken, 'update').mockResolvedValue([1]);
    await expect(auth.refresh(generateTokens({ id: 'u', role: 'customer' }, 'old').refreshToken, '127.0.0.1')).rejects.toMatchObject({ statusCode: 401 });
    expect(update).toHaveBeenCalled();
    expect(committed).toBe(true);
  });

  it('serializes simultaneous OTP verification and accepts the code only once', async () => {
    let consumed = false;
    let tail = Promise.resolve();
    const transaction = vi.spyOn(db.sequelize, 'transaction').mockImplementation((callback) => {
      const result = tail.then(() => callback({ LOCK: { UPDATE: 'UPDATE' } }));
      tail = result.catch(() => {});
      return result;
    });
    vi.spyOn(db.OtpToken, 'findOne').mockImplementation(async (options) => {
      // Emulate the database row lock only when the query actually requests it.
      if (options?.transaction) expect(options.lock).toBe('UPDATE');
      if (consumed) return null;
      return { otpHash: otp.hashOtp('123456'), attempts: 0, maxAttempts: 3, expiresAt: new Date(Date.now() + 60000), destroy: async () => { consumed = true; } };
    });
    const results = await Promise.allSettled([otp.verify('9999999999', '123456'), otp.verify('9999999999', '123456')]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('persists failed OTP attempts even though verification rejects', async () => {
    let committed = false;
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => {
      const result = await callback({ LOCK: { UPDATE: 'UPDATE' } });
      committed = true;
      return result;
    });
    const increment = vi.fn();
    vi.spyOn(db.OtpToken, 'findOne').mockResolvedValue({ otpHash: otp.hashOtp('123456'), attempts: 0, maxAttempts: 3, expiresAt: new Date(Date.now() + 60000), increment });
    await expect(otp.verify('9999999999', '000000')).rejects.toMatchObject({ statusCode: 400 });
    expect(increment).toHaveBeenCalled();
    expect(committed).toBe(true);
  });

  it.each(['admin', 'super_admin'])('denies password login for %s without MFA', async (role) => {
    vi.spyOn(LoginAttemptStore, 'checkLock').mockResolvedValue(undefined);
    vi.spyOn(LoginAttemptStore, 'clear').mockResolvedValue(undefined);
    vi.spyOn(LoginAttemptStore, 'recordFailure').mockResolvedValue(undefined);
    vi.spyOn(db.User, 'scope').mockReturnValue({ findOne: async () => ({ id: 'admin', role, status: 'active', twoFactorEnabled: false, validatePassword: async () => true }) });
    vi.spyOn(features, 'getResolvedFeature').mockResolvedValue(false);
    const create = vi.spyOn(db.RefreshToken, 'create').mockResolvedValue({});
    await expect(auth.login('admin@example.test', 'correct', '127.0.0.1')).rejects.toMatchObject({ code: 'MFA_REQUIRED', statusCode: 403 });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('Administrator MFA policy', () => {
  const policy = require('../../src/modules/auth/mfaPolicy');
  it('allows unenrolled administrators when mandatory MFA is explicitly disabled', () => {
    vi.stubEnv('REQUIRE_ADMIN_MFA', 'false');
    try {
      for (const user of [{ role: 'admin' }, { role: 'super_admin' }, { role: 'customer', roles: [{ baseRole: 'admin' }] }]) {
        expect(policy.requiresAdminMfa(user)).toBe(false);
        expect(() => policy.assertMfaEnrollment(user)).not.toThrow();
        expect(() => policy.assertMfaSession(user, {})).not.toThrow();
        const enrolledUser = { ...user, twoFactorEnabled: true };
        expect(() => policy.assertMfaSession(enrolledUser, {})).toThrow();
        expect(() => policy.assertMfaSession(enrolledUser, { mfa: true })).not.toThrow();
      }
    } finally { vi.unstubAllEnvs(); }
  });
  it.each([
    { role: 'admin' },
    { role: 'super_admin', roles: [] },
    { role: 'customer', roles: [{ slug: 'support', baseRole: 'admin' }] },
    { role: 'customer', roles: [{ slug: 'super_admin' }] },
  ])('requires MFA for administrative grants: %j', (user) => {
    expect(policy.requiresAdminMfa(user)).toBe(true);
    expect(() => policy.assertMfaEnrollment(user)).toThrow();
    expect(() => policy.assertMfaSession({ ...user, twoFactorEnabled: true }, {})).toThrow();
    expect(() => policy.assertMfaSession({ ...user, twoFactorEnabled: true }, { mfa: true })).not.toThrow();
  });
  it('keeps customer MFA optional', () => {
    expect(() => policy.assertMfaSession({ role: 'customer', roles: [] }, {})).not.toThrow();
  });
  it('records MFA evidence only when explicitly supplied by the verifier', () => {
    const jwt = require('jsonwebtoken');
    const user = { id: 'u', role: 'admin' };
    expect(jwt.decode(generateTokens(user, 's').accessToken).mfa).toBeUndefined();
    const tokens = generateTokens(user, 's', { mfaVerified: true });
    expect(jwt.decode(tokens.accessToken).mfa).toBe(true);
    expect(jwt.decode(tokens.refreshToken).mfa).toBe(true);
  });
  it('prevents administrators from disabling MFA', async () => {
    vi.spyOn(db.User, 'scope').mockReturnValue({ findByPk: async () => ({ id: 'u', role: 'customer', roles: [{ baseRole: 'admin', slug: 'support' }], twoFactorEnabled: true }) });
    const service = require('../../src/modules/auth/twoFactor.service');
    await expect(service.disable('u', '123456')).rejects.toMatchObject({ code: 'MFA_REQUIRED' });
  });
  it('does not create demo accounts when seeders are run', async () => {
    const seeder = require('../../seeders/20260402100001-demo-users');
    const queryInterface = { bulkInsert: vi.fn(), bulkDelete: vi.fn() };
    await seeder.up(queryInterface);
    await seeder.down(queryInterface);
    expect(queryInterface.bulkInsert).not.toHaveBeenCalled();
    expect(queryInterface.bulkDelete).not.toHaveBeenCalled();
  });
});

describe('MFA bypass paths', () => {
  const admin = { id: 'admin', email: 'admin@example.test', role: 'admin', status: 'active', twoFactorEnabled: false };
  it('denies phone login without administrator MFA', async () => {
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));
    vi.spyOn(db.UserProfile, 'findOne').mockResolvedValue({ userId: admin.id });
    vi.spyOn(db.User, 'findByPk').mockResolvedValue(admin);
    vi.spyOn(features, 'getResolvedFeature').mockResolvedValue(false);
    await expect(auth.loginByPhone('9999999999', '127.0.0.1')).rejects.toMatchObject({ code: 'MFA_REQUIRED' });
  });
  it('denies Google login without administrator MFA', async () => {
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback({}));
    vi.spyOn(db.User, 'findOne').mockResolvedValue(admin);
    const oauth = require('../../src/modules/auth/oauth.service');
    await expect(oauth.findOrCreateOAuthUser({ emails: [{ value: admin.email, verified: true }] }, '127.0.0.1')).rejects.toMatchObject({ code: 'MFA_REQUIRED' });
  });
  it('does not let an administrator trusted-device cookie skip MFA', async () => {
    vi.spyOn(LoginAttemptStore, 'checkLock').mockResolvedValue(undefined);
    vi.spyOn(LoginAttemptStore, 'clear').mockResolvedValue(undefined);
    const cookies = require('../../src/modules/auth/authCookies');
    const verify = vi.spyOn(cookies, 'verifyTrustedDevice').mockReturnValue(true);
    vi.spyOn(db.RememberedDevice, 'findOne').mockResolvedValue(null);
    vi.spyOn(db.User, 'scope').mockReturnValue({ findOne: async () => ({ ...admin, twoFactorEnabled: true, validatePassword: async () => true }) });
    vi.spyOn(features, 'getResolvedFeature').mockResolvedValue(false);
    expect(await auth.login(admin.email, 'correct', '127.0.0.1', false, '', 'trusted-cookie')).toMatchObject({ requiresTwoFactor: true });
    expect(verify).not.toHaveBeenCalled();
  });
  it('rejects pre-MFA administrator refresh sessions', async () => {
    vi.spyOn(features, 'getResolvedFeature').mockResolvedValue(false);
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (_options, callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));
    vi.spyOn(db.RefreshToken, 'findOne').mockResolvedValue({ id: 'old', userId: 'admin', createdAt: new Date(), lastActiveAt: new Date(), absoluteExpiresAt: new Date(Date.now() + 60000), expiresAt: new Date(Date.now() + 60000) });
    vi.spyOn(db.User, 'findByPk').mockResolvedValue({ ...admin, twoFactorEnabled: true });
    await expect(auth.refresh(generateTokens(admin, 'old').refreshToken, '127.0.0.1')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
  it('rejects pre-MFA administrator access sessions', async () => {
    const { authenticate } = require('../../src/middleware/auth.middleware');
    vi.spyOn(db.RefreshToken, 'findByPk').mockResolvedValue({ id: 'old', revokedAt: null, createdAt: new Date(), lastActiveAt: new Date(), absoluteExpiresAt: new Date(Date.now() + 60000), expiresAt: new Date(Date.now() + 60000) });
    vi.spyOn(db.User, 'findByPk').mockResolvedValue({ ...admin, twoFactorEnabled: true });
    const next = vi.fn();
    await authenticate({ headers: { authorization: `Bearer ${generateTokens(admin, 'old').accessToken}` } }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }));
  });
  it.each([
    ['missing', null],
    ['revoked', { id: 'old', revokedAt: new Date() }],
    ['expired', { id: 'old', revokedAt: null, expiresAt: new Date(Date.now() - 1000) }],
  ])('rejects an access token with a %s durable session', async (_state, session) => {
    const { authenticate } = require('../../src/middleware/auth.middleware');
    const findSession = vi.spyOn(db.RefreshToken, 'findByPk').mockResolvedValue(session);
    if (_state === 'expired') vi.spyOn(db.User, 'findByPk').mockResolvedValue({ id: 'admin', role: 'customer', status: 'active', twoFactorEnabled: false });
    const next = vi.fn();
    await authenticate({ headers: { authorization: `Bearer ${generateTokens(admin, 'old').accessToken}` } }, {}, next);
    expect(findSession).toHaveBeenCalledWith('old', expect.any(Object));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED', statusCode: 401 }));
  });
});

describe('Google OAuth state and email evidence', () => {
  const state = require('../../src/modules/auth/oauthState');
  it('binds the callback to the browser that initiated login', () => {
    let cookie; let nonce;
    const res = { cookie: vi.fn((_name, value) => { cookie = value; }), clearCookie: vi.fn() };
    state.store({ res }, (err, value) => { expect(err).toBeNull(); nonce = value; });
    const done = vi.fn();
    state.verify({ res, cookies: { oauth_google_state: cookie } }, nonce, done);
    expect(done).toHaveBeenCalledWith(null, true, undefined);
    expect(res.clearCookie).toHaveBeenCalled();
    for (const [cookies, supplied] of [[{}, nonce], [{ oauth_google_state: cookie }, 'wrong'], [{ oauth_google_state: cookie + 'x' }, nonce]]) {
      done.mockClear();
      state.verify({ res, cookies }, supplied, done);
      expect(done).toHaveBeenCalledWith(null, false, expect.any(Object));
    }
  });
  it.each([undefined, false])('rejects Google email verification claim %s', async (verified) => {
    const oauth = require('../../src/modules/auth/oauth.service');
    const find = vi.spyOn(db.User, 'findOne');
    await expect(oauth.findOrCreateOAuthUser({ emails: [{ value: 'user@example.test', verified }] }, '127.0.0.1')).rejects.toThrow('verified email');
    expect(find).not.toHaveBeenCalled();
  });
});

describe('Bcrypt input boundaries', () => {
  const policy = require('../../src/modules/auth/passwordPolicy');
  it('accepts exactly 72 UTF-8 bytes and rejects passwords with a discarded suffix', () => {
    const prefix = 'Aa1!' + 'a'.repeat(68);
    expect(policy.validate(prefix).error).toBeUndefined();
    expect(policy.validate(prefix + 'b').error).toBeDefined();
    expect(policy.validate('Aa1!' + '😀'.repeat(18)).error).toBeDefined();
  });
});

describe('MFA recovery codes', () => {
  it('loads protected backup hashes under lock and consumes each code once', async () => {
    const crypto = require('crypto');
    const service = require('../../src/modules/auth/twoFactor.service');
    const hash = crypto.createHash('sha256').update('abcd1234').digest('hex');
    const locked = { twoFactorBackupCodes: [hash], save: vi.fn() };
    const findByPk = vi.fn().mockResolvedValue(locked);
    const scope = vi.spyOn(db.User, 'scope').mockReturnValue({ findByPk });
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));
    const user = { id: 'u', twoFactorBackupCodes: [hash] };
    expect(await service.verifyBackupCode(user, 'abcd1234')).toBe(true);
    expect(scope).toHaveBeenCalledWith('withPassword');
    expect(findByPk).toHaveBeenCalledWith('u', expect.objectContaining({ lock: 'UPDATE' }));
    expect(locked.save).toHaveBeenCalled();
    expect(await service.verifyBackupCode(user, 'abcd1234')).toBe(false);
  });
});
