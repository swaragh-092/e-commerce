'use strict';

// Run only in an operator-controlled terminal on the target server.
// Never run this through CI: setup displays the MFA provisioning secret.
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const os = require('node:os');
const { sequelize, User, Role, Permission, AuditLog } = require('../modules');
const TwoFactorService = require('../modules/auth/twoFactor.service');
const { classifyUser } = require('../modules/auth/mfaPolicy');
const { revokeUserSessions } = require('../modules/auth/sessionRevocation');
const rememberedDevices = require('../modules/auth/rememberedDevice');

const authorizationInclude = [{ model: Role, as: 'roles', include: [{ model: Permission, as: 'permissions' }] }];

const resetForReenrollment = async (userId, email, operator) => sequelize.transaction(async transaction => {
  const locked = await User.findByPk(userId, {
    include: authorizationInclude, transaction, lock: { level: transaction.LOCK.UPDATE, of: User },
  });
  if (!locked || locked.status !== 'active' || !classifyUser(locked).administrative
      || !locked.twoFactorEnabled || String(locked.email).trim().toLowerCase() !== email) {
    throw new Error('Account changed during recovery');
  }
  await locked.update({ twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: null }, { transaction });
  await revokeUserSessions([locked.id], transaction);
  await rememberedDevices.revokeAll(locked.id, transaction);
  await AuditLog.create({
    userId: locked.id,
    action: 'UPDATE',
    entity: 'USER',
    entityId: locked.id,
    changes: { mfaRecovery: 'operator_reset_for_reenrollment', operator },
  }, { transaction });
});

const main = async () => {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--recover') || args.filter(arg => arg === '--recover').length > 1) {
    throw new Error('Usage: node src/scripts/enrollAdminMfa.js [--recover]');
  }
  const recovery = args.includes('--recover');
  if (!stdin.isTTY || !stdout.isTTY) throw new Error('Interactive operator terminal required');
  const prompt = readline.createInterface({ input: stdin, output: stdout });
  try {
    const email = (await prompt.question('Administrator email: ')).trim().toLowerCase();
    const user = await User.findOne({ where: { email }, include: authorizationInclude });
    if (!user || user.status !== 'active' || !classifyUser(user).administrative) {
      throw new Error('An active administrator account is required');
    }
    if (user.twoFactorEnabled && !recovery) throw new Error('MFA is already enabled; use --recover only after out-of-band identity verification');
    if (recovery && !user.twoFactorEnabled) {
      stdout.write('MFA is already disabled; continuing with operator-assisted enrollment.\n');
    }
    const confirmation = recovery ? 'RESET AND RE-ENROLL' : 'ENROLL';
    const confirm = await prompt.question(`Confirm identity was verified out of band (type ${confirmation}): `);
    if (confirm !== confirmation) throw new Error('Enrollment cancelled');
    if (recovery && user.twoFactorEnabled) {
      await resetForReenrollment(user.id, email, os.userInfo().username);
    }
    const setup = await TwoFactorService.setup(user.id);
    stdout.write(`\nSensitive enrollment URI — transfer privately to the account owner:\n${setup.otpauth}\n\n`);
    const code = (await prompt.question('Current six-digit code from the owner: ')).trim();
    if (!/^\d{6}$/.test(code)) throw new Error('A six-digit code is required');
    const result = await TwoFactorService.enable(user.id, code);
    stdout.write(`\nMFA enabled. Transfer these single-use backup codes privately; they are shown once:\n${result.backupCodes.join('\n')}\n`);
  } finally {
    prompt.close();
  }
};
module.exports = { resetForReenrollment };

if (require.main === module) {
  main().catch(() => {
    // Do not print error objects that may include DB credentials or parameters.
    process.stderr.write('Enrollment failed. Verify account status, identity, code, and database access. If recovery reset MFA, rerun with --recover after resolving the cause.\n');
    process.exitCode = 1;
  }).finally(() => sequelize.close());
}
