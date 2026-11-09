import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const mail = require('../../src/modules/notification/channels/email.channel');
const auth = require('../../src/modules/auth/auth.service');
const attempts = require('../../src/modules/auth/loginAttemptStore');
const factors = require('../../src/modules/auth/twoFactor.service');
const audit = require('../../src/modules/audit/audit.service');
const emailMfa = require('../../src/modules/auth/emailMfa.service');
const { signTempTwoFactorToken } = require('../../src/modules/auth/tokenUtils');
const policy = { requireAdministrators: true, staffMode: 'all', requiredRoleIds: [], allowEmailCodes: true };
let user, row, code;

beforeEach(() => {
  vi.stubEnv('JWT_ACCESS_SECRET', 'test-email-challenge-signing-key');
  vi.stubEnv('JWT_REFRESH_SECRET', 'test-refresh-signing-key');
  user = {
    id: 'staff', role: 'admin', status: 'active', emailVerified: true, email: 'staff@example.test',
    twoFactorEnabled: true, twoFactorSecret: { data: 'factor' }, password: 'original-password-hash',
    update: vi.fn(),
  };
  user.emailMfaPasswordBinding = emailMfa.binding(user);
  row = undefined;
  vi.spyOn(db.sequelize, 'transaction').mockImplementation(callback => callback({ LOCK: { UPDATE: 'UPDATE' } }));
  vi.spyOn(db.User, 'scope').mockReturnValue({ findByPk: async () => user });
  vi.spyOn(db.User, 'findByPk').mockResolvedValue({ id: user.id, role: user.role });
  vi.spyOn(db.Setting, 'findOne').mockResolvedValue({ value: policy });
  vi.spyOn(db.OtpToken, 'findOne').mockImplementation(async () => row);
  vi.spyOn(db.OtpToken, 'create').mockImplementation(async values => {
    row = {
      ...values, createdAt: new Date(), attempts: 0,
      increment: async () => { row.attempts += 1; },
      update: async values => Object.assign(row, values),
    };
    return row;
  });
  vi.spyOn(db.RefreshToken, 'create').mockResolvedValue({});
  vi.spyOn(mail, 'send').mockImplementation(async message => {
    expect(message).toMatchObject({ to: user.email, sensitive: true });
    code = message.text.match(/\b\d{6}\b/)[0];
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Email sign-in alternate', () => {
  it('rejects a regular authenticator challenge', async () => {
    await expect(emailMfa.sendCode(signTempTwoFactorToken(user.id))).rejects.toMatchObject({ statusCode: 401 });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('offers email on later password sign-ins after an authenticator code proves the current password', async () => {
    user.emailMfaPasswordBinding = null;
    user.validatePassword = async () => true;
    user.update.mockImplementation(async values => Object.assign(user, values));
    db.User.scope.mockReturnValue({ findByPk: async () => user, findOne: async () => user });
    vi.spyOn(attempts, 'checkLock').mockResolvedValue();
    vi.spyOn(attempts, 'clear').mockResolvedValue();
    vi.spyOn(factors, 'verify').mockReturnValue(true);
    vi.spyOn(audit, 'log').mockResolvedValue();

    const firstLogin = await auth.login(user.email, 'correct-password');
    expect(firstLogin).not.toHaveProperty('emailChallenge');
    await auth.verifyTwoFactor(firstLogin.tempToken, '123456');
    const nextLogin = await auth.login(user.email, 'correct-password');
    expect(nextLogin).toHaveProperty('emailChallenge');
    expect(nextLogin).not.toHaveProperty('tokens');
  });

  it('requires new authenticator proof after a password reset', async () => {
    const oldChallenge = emailMfa.issueChallenge(user);
    user.password = 'reset-password-hash';
    expect(emailMfa.isBound(user)).toBe(false);
    await expect(emailMfa.sendCode(oldChallenge)).rejects.toMatchObject({ statusCode: 401 });
    await expect(emailMfa.sendCode(emailMfa.issueChallenge(user))).rejects.toMatchObject({ statusCode: 401 });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('binds the code to its challenge and creates one email-verified session', async () => {
    const challenge = emailMfa.issueChallenge(user);
    await emailMfa.sendCode(challenge);
    expect(db.RefreshToken.create).not.toHaveBeenCalled();
    await expect(emailMfa.verifyCode(emailMfa.issueChallenge(user), code)).rejects.toMatchObject({ statusCode: 400 });
    const result = await emailMfa.verifyCode(challenge, code);
    expect(result).toHaveProperty('tokens');
    await expect(emailMfa.verifyCode(challenge, code)).rejects.toMatchObject({ statusCode: 400 });
    expect(db.RefreshToken.create).toHaveBeenCalledTimes(1);

    const jwt = require('jsonwebtoken');
    const claims = jwt.verify(result.tokens.accessToken, process.env.JWT_ACCESS_SECRET);
    const mfaPolicy = require('../../src/modules/auth/mfaPolicy');
    expect(claims.mfaBinding).toBe(user.emailMfaPasswordBinding);
    expect(() => mfaPolicy.assertMfaSession(user, claims, policy)).not.toThrow();
    user.email = 'changed@example.test';
    expect(() => mfaPolicy.assertMfaSession(user, claims, policy)).toThrow();
  });

  it('keeps a per-account guess limit when another challenge asks for a code', async () => {
    const challenge = emailMfa.issueChallenge(user);
    await emailMfa.sendCode(challenge);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 3; i += 1) {
      await expect(emailMfa.verifyCode(challenge, wrong)).rejects.toMatchObject({ statusCode: 400 });
    }
    await expect(emailMfa.sendCode(emailMfa.issueChallenge(user))).rejects.toMatchObject({ statusCode: 429 });
    await expect(emailMfa.verifyCode(challenge, code)).rejects.toMatchObject({ statusCode: 400 });
    expect(db.RefreshToken.create).not.toHaveBeenCalled();
  });

  it('rejects a code when the policy is turned off before verification', async () => {
    const challenge = emailMfa.issueChallenge(user);
    await emailMfa.sendCode(challenge);
    db.Setting.findOne.mockResolvedValue({ value: { ...policy, allowEmailCodes: false } });
    await expect(emailMfa.verifyCode(challenge, code)).rejects.toMatchObject({ statusCode: 401 });
    expect(db.RefreshToken.create).not.toHaveBeenCalled();
  });
});
