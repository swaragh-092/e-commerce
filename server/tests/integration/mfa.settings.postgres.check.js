'use strict';

// Explicit local-only check. Every fixture and setting change is rolled back.
const path = require('node:path');
require('dotenv').config({ path: process.env.AUTH_TEST_ENV_FILE || path.resolve(__dirname, '../../../.env') });
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)) {
  throw new Error('This check requires a local, non-production database');
}
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const db = require('../../src/modules');
const policy = require('../../src/modules/auth/mfaPolicy');
db.sequelize.options.logging = false;
const rollback = new Error('ROLLBACK_FIXTURES');
let step = 'database connection';
const main = async () => {
  await db.sequelize.authenticate();
  try {
    await db.sequelize.transaction(async transaction => {
      const marker = `mfa-check-${crypto.randomUUID()}`;
      step = 'role fixture';
      const role = await db.Role.create({ name: marker, slug: marker, baseRole: 'admin', isActive: true }, { transaction });
      step = 'account fixture';
      const user = await db.User.create({ email: `${marker}@example.test`, firstName: 'Disposable', lastName: 'MFA Check',
        password: `${crypto.randomBytes(24).toString('hex')}Aa1!`, role: 'admin', status: 'active', emailVerified: true,
      }, { transaction });
      step = 'role assignment';
      await user.setRoles([role], { transaction });
      step = 'account row locks';
      const users = await db.User.findAll({ where: { id: user.id, status: 'active' },
        include: [{ model: db.Role, as: 'roles', through: { attributes: [] } }],
        order: [['id', 'ASC']], transaction, lock: { level: transaction.LOCK.UPDATE, of: db.User },
      });
      const value = { requireAdministrators: false, staffMode: 'selected', requiredRoleIds: [role.id] };
      step = 'policy persistence';
      await db.Setting.upsert({ group: 'auth', key: 'mfaPolicy', value, updatedBy: user.id }, { transaction });
      const saved = await policy.loadMfaPolicy(users[0], transaction);
      assert.deepEqual(saved, value);
      assert.equal(policy.isEnrollmentRequired(users[0], saved), true);
      assert.equal(policy.isEnrollmentRequired(users[0], { ...saved, staffMode: 'optional' }), false);
      assert.equal(policy.isEnrollmentRequired({ role: 'customer' }, saved), false);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log('PASS PostgreSQL staff-role loading, account row locks, policy persistence, and customer exclusion; fixtures rolled back');
};
main().catch(error => {
  console.error(`FAIL local MFA PostgreSQL check at ${step}: ${error.name} (${error.original?.code || error.code || 'no database code'})`);
  process.exitCode = 1;
}).finally(() => db.sequelize.close());
