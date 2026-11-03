'use strict';

// Run only in an operator-controlled terminal on the target server.
// Never run this through CI: setup displays the MFA provisioning secret.
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { sequelize, User } = require('../modules');
const TwoFactorService = require('../modules/auth/twoFactor.service');
const { requiresAdminMfa } = require('../modules/auth/mfaPolicy');

const main = async () => {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error('Interactive operator terminal required');
  const prompt = readline.createInterface({ input: stdin, output: stdout });
  try {
    const email = (await prompt.question('Administrator email: ')).trim().toLowerCase();
    const user = await User.findOne({ where: { email }, include: ['roles'] });
    if (!user || user.status !== 'active' || !requiresAdminMfa(user)) {
      throw new Error('An active administrator account is required');
    }
    if (user.twoFactorEnabled) throw new Error('MFA is already enabled; this tool does not reset it');
    const confirm = await prompt.question('Confirm identity was verified out of band (type ENROLL): ');
    if (confirm !== 'ENROLL') throw new Error('Enrollment cancelled');
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
main().catch(() => {
  // Do not print error objects that may include DB credentials or parameters.
  process.stderr.write('Enrollment failed. Verify account status, identity, code, and database access.\n');
  process.exitCode = 1;
}).finally(() => sequelize.close());
