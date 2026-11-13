'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
if (process.env.NODE_ENV === 'production' || !['127.0.0.1', 'localhost'].includes(process.env.DB_HOST)) {
  throw new Error('Use a disposable local database for this check');
}
process.env.JWT_ACCESS_SECRET = crypto.randomBytes(32).toString('hex');
process.env.JWT_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');
process.env.REQUIRE_ADMIN_MFA = 'false';
const db = require('../../src/modules');
db.sequelize.options.logging = false;
const auth = require('../../src/modules/auth/auth.service');
const { authenticate } = require('../../src/middleware/auth.middleware');
const { generateTokens, hashToken } = require('../../src/modules/auth/tokenUtils');
require('../../src/modules/notification/notification.service').send = async () => {};
require('../../src/modules/audit/audit.service').log = async () => {};
require('../../src/middleware/featureGate.middleware').getResolvedFeature = async () => false;
const marker = `session-check-${crypto.randomUUID()}`;
const users = [];
let role;
const check = async (name, run) => { await run(); console.log(`PASS ${name}`); };
const access = token => new Promise(resolve => authenticate({ headers: { authorization: `Bearer ${token}` } }, {}, error => resolve(error)));
const makeSession = async (user, { absolute = Date.now() + 43200000, activity = Date.now() } = {}) => {
  const id = crypto.randomUUID();
  const tokens = generateTokens(user, id);
  const row = await db.RefreshToken.create({ id, userId: user.id, token: hashToken(tokens.refreshToken), expiresAt: new Date(Date.now() + 86400000), absoluteExpiresAt: new Date(absolute), lastActiveAt: new Date(activity) });
  return { row, tokens };
};
(async () => {
  await db.sequelize.authenticate();
  const password = `${crypto.randomBytes(24).toString('hex')}Aa1!`;
  const customer = await db.User.create({ email: `${marker}-customer@example.com`, firstName: 'Test', lastName: 'Customer', password, role: 'customer', status: 'active', emailVerified: true });
  users.push(customer);
  const staff = await db.User.create({ email: `${marker}-staff@example.com`, firstName: 'Test', lastName: 'Staff', password, role: 'admin', status: 'active', emailVerified: true });
  users.push(staff);
  role = await db.Role.create({ name: marker, slug: marker, baseRole: 'admin' });
  const [permission] = await db.Permission.findOrCreate({ where: { key: 'dashboard.view' }, defaults: { name: 'Dashboard', group: 'dashboard' } });
  await role.addPermission(permission);
  await staff.addRole(role);
  await check('remembered device is hashed, expires and can be revoked independently', async () => {
    const devices = require('../../src/modules/auth/rememberedDevice');
    const token = await devices.issue(staff.id);
    const stored = await db.RememberedDevice.findOne({ where: { userId: staff.id } });
    assert.notEqual(stored.tokenHash, token);
    assert.equal(await devices.recognize(token, staff.id), true);
    assert.equal(await devices.recognize(token, customer.id), false);
    const fakeAccess = await access(token);
    assert.equal(fakeAccess?.statusCode, 401);
    await devices.revoke(token);
    assert.equal(await devices.recognize(token, staff.id), false);
    const expiring = await devices.issue(staff.id);
    await db.RememberedDevice.update({ expiresAt: new Date(0) }, { where: { tokenHash: devices.hash(expiring) } });
    assert.equal(await devices.recognize(expiring, staff.id), false);
  });
  await check('custom-role admin idle timeout blocks protected requests and refresh', async () => {
    const s = await makeSession(staff, { activity: Date.now() - 1800001 });
    assert.equal((await access(s.tokens.accessToken))?.code, 'ADMIN_SESSION_EXPIRED');
    await assert.rejects(auth.refresh(s.tokens.refreshToken, '127.0.0.1'), e => e.code === 'ADMIN_SESSION_EXPIRED');
  });
  await check('administrative JWT without a durable session fails closed', async () => {
    assert.equal((await access(generateTokens(staff).accessToken))?.code, 'ADMIN_SESSION_EXPIRED');
  });
  await check('absolute timeout blocks even with recent activity', async () => {
    const s = await makeSession(staff, { absolute: Date.now() - 1 });
    assert.equal((await access(s.tokens.accessToken))?.code, 'ADMIN_SESSION_EXPIRED');
    await assert.rejects(auth.refresh(s.tokens.refreshToken, '127.0.0.1'), e => e.code === 'ADMIN_SESSION_EXPIRED');
  });
  await check('admin rotation preserves absolute expiry and user activity', async () => {
    const s = await makeSession(staff, { activity: Date.now() - 300000 });
    const result = await auth.refresh(s.tokens.refreshToken, '127.0.0.1');
    const successor = await db.RefreshToken.findOne({ where: { token: hashToken(result.tokens.refreshToken) } });
    assert.equal(+successor.absoluteExpiresAt, +s.row.absoluteExpiresAt);
    assert.equal(+successor.lastActiveAt, +s.row.lastActiveAt);
  });
  await check('customer sessions ignore admin idle and absolute deadlines', async () => {
    const s = await makeSession(customer, { activity: Date.now() - 3600000, absolute: Date.now() - 1 });
    assert.equal(await access(s.tokens.accessToken), undefined);
    const result = await auth.refresh(s.tokens.refreshToken, '127.0.0.1');
    assert.ok(result.tokens.accessToken);
  });
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const user of users) {
    await db.RefreshToken.destroy({ where: { userId: user.id } });
    await db.User.destroy({ where: { id: user.id }, force: true });
  }
  if (role) await role.destroy();
  await db.sequelize.close();
});
