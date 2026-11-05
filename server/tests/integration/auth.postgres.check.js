'use strict';

// Explicit local integration check; not part of the mocked unit-test glob.
// Uses disposable records, sends no notifications, and never resets a database.
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)) {
  throw new Error('This check requires a local, non-production database');
}
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
process.env.JWT_ACCESS_SECRET = crypto.randomBytes(32).toString('hex');
process.env.JWT_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');
const db = require('../../src/modules');
db.sequelize.options.logging = false;
const auth = require('../../src/modules/auth/auth.service');
const otp = require('../../src/modules/auth/otp.service');
const loginAttempts = require('../../src/modules/auth/loginAttemptStore');
const Store = require('../../src/utils/postgresRateLimitStore');
const { generateTokens, hashToken } = require('../../src/modules/auth/tokenUtils');
const { authenticate } = require('../../src/middleware/auth.middleware');
const blocklist = require('../../src/utils/tokenBlocklist');
const { revokeUserSessions } = require('../../src/modules/auth/sessionRevocation');
// Delivery/audit are not the subject of these checks; do not contact providers.
require('../../src/modules/notification/notification.service').send = async () => {};
require('../../src/modules/audit/audit.service').log = async () => {};
require('../../src/middleware/featureGate.middleware').getResolvedFeature = async () => false;
const marker = `security-check-${crypto.randomUUID()}`;
const email = `${marker}@example.com`;
const phone = marker; // Used only as an internal OTP identifier; no SMS is sent.
const stores = [new Store(marker), new Store(marker)];
stores.forEach(store => store.init({ windowMs: 60000 }));
let user;
let testCredential = `${crypto.randomBytes(24).toString('hex')}Aa1!`;
let step = 'setup';
let passed = 0;
const check = async (name, fn) => { step = name; await fn(); passed += 1; console.log(`PASS ${name}`); };
const newSession = async (expired = false) => {
  const id = crypto.randomUUID();
  const tokens = generateTokens(user, id);
  await db.RefreshToken.create({ id, userId: user.id, token: hashToken(tokens.refreshToken), expiresAt: new Date(Date.now() + (expired ? -1000 : 86400000)) });
  return { id, tokens };
};
(async () => {
  await db.sequelize.authenticate();
  user = await db.User.create({ email, firstName: 'Disposable', lastName: 'Security Check', password: testCredential, role: 'customer', status: 'active', emailVerified: true });
  await check('rate limits share atomic counters across store instances', async () => {
    const counts = await Promise.all(stores.map(store => store.increment(marker)));
    assert.deepEqual(counts.map(result => result.totalHits).sort(), [1, 2]);
  });
  await check('account failures persist and lock after five attempts', async () => {
    for (let i = 0; i < 5; i++) await loginAttempts.recordFailure(email);
    await assert.rejects(loginAttempts.checkLock(email), error => error.statusCode === 429);
    await loginAttempts.clear(email);
  });
  await check('email throttle grants only the first send claim', async () => {
    const results = await Promise.all([loginAttempts.claimEmailSend(marker, email), loginAttempts.claimEmailSend(marker, email)]);
    assert.deepEqual(results.sort(), [false, true]);
  });
  await check('simultaneous OTP consumption succeeds exactly once', async () => {
    const code = await otp.generate(phone);
    const results = await Promise.allSettled([otp.verify(phone, code), otp.verify(phone, code)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(await db.OtpToken.count({ where: { identifier: phone } }), 0);
  });
  await check('expired OTP is rejected and removed', async () => {
    await db.OtpToken.create({ identifier: phone, purpose: 'login', otpHash: otp.hashOtp('123456'), expiresAt: new Date(Date.now() - 1000), attempts: 0, maxAttempts: 3 });
    await assert.rejects(otp.verify(phone, '123456'), error => error.statusCode === 400);
    assert.equal(await db.OtpToken.count({ where: { identifier: phone } }), 0);
  });
  await check('simultaneous refresh permits one rotation and commits replay revocation', async () => {
    const { tokens } = await newSession();
    const results = await Promise.allSettled([auth.refresh(tokens.refreshToken, '127.0.0.1'), auth.refresh(tokens.refreshToken, '127.0.0.1')]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(await db.RefreshToken.count({ where: { userId: user.id, revokedAt: null } }), 0);
  });
  await check('expired refresh session is rejected', async () => {
    const { tokens } = await newSession(true);
    await assert.rejects(auth.refresh(tokens.refreshToken, '127.0.0.1'), error => error.statusCode === 401);
  });
  await check('access is denied when the durable session has expired', async () => {
    const { tokens } = await newSession(true);
    let denied;
    await authenticate({ headers: { authorization: `Bearer ${tokens.accessToken}` } }, {}, error => { denied = error; });
    assert.equal(denied?.statusCode, 401);
  });
  await check('logout invalidates access through durable state without the memory cache', async () => {
    const { id, tokens } = await newSession();
    await auth.logout(tokens.refreshToken);
    assert.ok((await db.RefreshToken.findByPk(id)).revokedAt);
    const original = blocklist.isSessionRevoked;
    blocklist.isSessionRevoked = () => false;
    try {
      let denied;
      await authenticate({ headers: { authorization: `Bearer ${tokens.accessToken}` } }, {}, error => { denied = error; });
      assert.equal(denied?.statusCode, 401);
    } finally { blocklist.isSessionRevoked = original; }
  });
  await check('logout follows rotation successors without revoking another device', async () => {
    const original = await newSession();
    const other = await newSession();
    await auth.refresh(original.tokens.refreshToken, '127.0.0.1');
    const rotated = await db.RefreshToken.findByPk(original.id);
    assert.ok(rotated.replacedByTokenId);
    await auth.logout(original.tokens.refreshToken);
    assert.ok((await db.RefreshToken.findByPk(rotated.replacedByTokenId)).revokedAt);
    assert.equal((await db.RefreshToken.findByPk(other.id)).revokedAt, null);
  });
  await check('simultaneous logout and refresh leave no active successor', async () => {
    const original = await newSession();
    const results = await Promise.allSettled([auth.refresh(original.tokens.refreshToken, '127.0.0.1'), auth.logout(original.tokens.refreshToken)]);
    assert.equal(results[1].status, 'fulfilled');
    const row = await db.RefreshToken.findByPk(original.id);
    assert.ok(row.revokedAt);
    if (row.replacedByTokenId) assert.ok((await db.RefreshToken.findByPk(row.replacedByTokenId)).revokedAt);
  });
  await check('a late refresh after logout cannot terminate another device', async () => {
    const original = await newSession();
    const other = await newSession();
    await auth.logout(original.tokens.refreshToken);
    await assert.rejects(auth.refresh(original.tokens.refreshToken, '127.0.0.1'), error => error.statusCode === 401);
    assert.equal((await db.RefreshToken.findByPk(other.id)).revokedAt, null);
  });
  await check('permission revocation rolls back with the grant transaction', async () => {
    const { id } = await newSession();
    await assert.rejects(db.sequelize.transaction(async transaction => {
      await revokeUserSessions([user.id], transaction);
      assert.ok((await db.RefreshToken.findByPk(id, { transaction })).revokedAt);
      throw new Error('test rollback');
    }), /test rollback/);
    assert.equal((await db.RefreshToken.findByPk(id)).revokedAt, null);
    await db.sequelize.transaction(transaction => revokeUserSessions([user.id], transaction));
    assert.ok((await db.RefreshToken.findByPk(id)).revokedAt);
  });
  await check('permission revocation waits for rotation and revokes its committed successor', async () => {
    const original = await newSession();
    const originalCreate = db.RefreshToken.create;
    let signalCreated;
    let releaseCreate;
    const successorCreated = new Promise(resolve => { signalCreated = resolve; });
    const allowRefreshCommit = new Promise(resolve => { releaseCreate = resolve; });
    db.RefreshToken.create = async function (values, ...args) {
      const record = await originalCreate.call(this, values, ...args);
      if (values.userId === user.id && values.id !== original.id) {
        signalCreated();
        await allowRefreshCommit;
      }
      return record;
    };

    let refreshResult;
    let refreshing;
    let revokePromise;
    try {
      // Pause refresh after inserting its successor, while it still owns the
      // user and predecessor-row locks. Revocation must queue on that same user
      // lock, then take a fresh statement snapshot after the rotation commits.
      refreshing = auth.refresh(original.tokens.refreshToken, '127.0.0.1');
      let createTimeout;
      try {
        await Promise.race([
          successorCreated,
          new Promise((_, reject) => { createTimeout = setTimeout(() => reject(new Error('refresh did not create successor')), 5000); }),
        ]);
      } finally { clearTimeout(createTimeout); }

      revokePromise = db.sequelize.transaction(async transaction => {
        await db.sequelize.query("SET LOCAL application_name = 'security-revocation-race-check'", { transaction });
        await revokeUserSessions([user.id], transaction);
      });

      // Wait until PostgreSQL confirms revocation is blocked behind refresh.
      // This distinguishes an actual lock-ordering test from a timing-only race.
      const deadline = Date.now() + 5000;
      let waiting = false;
      while (Date.now() < deadline && !waiting) {
        const [rows] = await db.sequelize.query(`
          SELECT EXISTS (
            SELECT 1 FROM pg_stat_activity
            WHERE application_name = 'security-revocation-race-check'
              AND wait_event_type = 'Lock'
          ) AS waiting
        `);
        waiting = rows[0]?.waiting === true;
        if (!waiting) await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert.equal(waiting, true, 'revocation should be queued on the in-flight refresh lock');

      releaseCreate();
      refreshResult = await refreshing;
      await revokePromise;
      const predecessor = await db.RefreshToken.findByPk(original.id);
      assert.ok(predecessor.replacedByTokenId);
      assert.ok(predecessor.revokedAt);
      const successor = await db.RefreshToken.findByPk(predecessor.replacedByTokenId);
      assert.ok(successor, 'rotation successor should have committed');
      assert.ok(successor.revokedAt, 'permission revocation must revoke the committed successor');
      assert.ok(refreshResult.tokens.refreshToken);
    } finally {
      releaseCreate();
      if (refreshing) await refreshing.catch(() => {});
      db.RefreshToken.create = originalCreate;
      if (revokePromise) await revokePromise.catch(() => {});
    }
  });
  await check('password reset consumes its token and revokes existing sessions', async () => {
    const reset = crypto.randomBytes(32).toString('hex');
    const { id } = await newSession();
    await db.PasswordResetToken.create({ userId: user.id, token: hashToken(reset), purpose: 'password_reset', expiresAt: new Date(Date.now() + 60000) });
    testCredential = `${crypto.randomBytes(24).toString('hex')}Aa1!`;
    await auth.resetPassword(reset, testCredential);
    await assert.rejects(auth.resetPassword(reset, testCredential), error => error.statusCode === 400);
    assert.ok((await db.RefreshToken.findByPk(id)).revokedAt);
    const updated = await db.User.scope('withPassword').findByPk(user.id);
    assert.equal(await updated.validatePassword(testCredential), true);
  });
  await check('simultaneous password reset consumes the token only once', async () => {
    const reset = crypto.randomBytes(32).toString('hex');
    await db.PasswordResetToken.create({ userId: user.id, token: hashToken(reset), purpose: 'password_reset', expiresAt: new Date(Date.now() + 60000) });
    const candidates = [0, 1].map(() => `${crypto.randomBytes(24).toString('hex')}Aa1!`);
    const results = await Promise.allSettled(candidates.map(candidate => auth.resetPassword(reset, candidate)));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    testCredential = candidates[results.findIndex(result => result.status === 'fulfilled')];
    assert.equal(await db.PasswordResetToken.count({ where: { userId: user.id, token: hashToken(reset) } }), 0);
  });
  await check('expired reset token cannot change the password', async () => {
    const reset = crypto.randomBytes(32).toString('hex');
    await db.PasswordResetToken.create({ userId: user.id, token: hashToken(reset), purpose: 'password_reset', expiresAt: new Date(Date.now() - 1000) });
    await assert.rejects(auth.resetPassword(reset, `${crypto.randomBytes(24).toString('hex')}Aa1!`), error => error.statusCode === 400);
    assert.equal(await (await db.User.scope('withPassword').findByPk(user.id)).validatePassword(testCredential), true);
  });
  await check('administrator password login is denied until enrollment and successful MFA', async () => {
    await user.update({ role: 'admin', twoFactorEnabled: false });
    await assert.rejects(auth.login(email, testCredential, '127.0.0.1'), error => error.code === 'MFA_REQUIRED');
    const factors = require('../../src/modules/auth/twoFactor.service');
    const { authenticator } = require('otplib');
    const setup = await factors.setup(user.id);
    const enabled = await factors.enable(user.id, authenticator.generate(setup.secret));
    const challenge = await auth.login(email, testCredential, '127.0.0.1');
    assert.equal(challenge.requiresTwoFactor, true);
    assert.equal(challenge.tokens, undefined);
    const result = await auth.verifyTwoFactor(challenge.tempToken, authenticator.generate(setup.secret), '127.0.0.1');
    const claims = require('jsonwebtoken').verify(result.tokens.accessToken, process.env.JWT_ACCESS_SECRET, require('../../src/modules/auth/tokenUtils').getIssAud());
    assert.equal(claims.mfa, true);
    const updated = await db.User.scope('withPassword').findByPk(user.id);
    assert.equal(await factors.verifyBackupCode(updated, enabled.backupCodes[0]), true);
    assert.equal(await factors.verifyBackupCode(updated, enabled.backupCodes[0]), false);
  });
  console.log(`${passed} local PostgreSQL security checks passed`);
})().catch(error => {
  console.error(JSON.stringify({ failedCheck: step, errorType: error.name, errorCode: error.original?.code || error.code || null }));
  process.exitCode = 1;
}).finally(async () => {
  try {
    await db.OtpToken.destroy({ where: { identifier: phone } });
    await stores[0].resetAll();
    await loginAttempts.clear(email);
    const emailHash = crypto.createHmac('sha256', process.env.JWT_ACCESS_SECRET).update(`${marker}\0${email}`).digest('hex');
    await db.sequelize.query('DELETE FROM auth_email_throttles WHERE email_hash = :emailHash', { replacements: { emailHash } });
    if (user) {
      await db.RefreshToken.destroy({ where: { userId: user.id } });
      await db.PasswordResetToken.destroy({ where: { userId: user.id } });
      await user.destroy({ force: true });
    }
  } catch { console.error('Disposable-record cleanup failed; check the security-check fixture records'); process.exitCode = 1; }
  await db.sequelize.close();
});
