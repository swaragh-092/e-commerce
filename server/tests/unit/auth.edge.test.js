import { describe, it, expect, beforeEach } from 'vitest';

process.env.JWT_ACCESS_SECRET = 'test-access-secret-32chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-long!';
process.env.JWT_ISSUER = 'ecommerce-pro';
process.env.JWT_AUDIENCE = 'ecommerce-pro-client';

describe('Edge — session sid kill-switch (tokenBlocklist)', () => {
  let tokenBlocklist;
  beforeEach(async () => {
    const mod = await import('../../src/utils/tokenBlocklist.js');
    tokenBlocklist = mod.default || mod;
  });

  it('flags a revoked sid and ignores unknown sids', () => {
    expect(tokenBlocklist.isSessionRevoked('nope')).toBe(false);
    tokenBlocklist.revokeSession('sid-123');
    expect(tokenBlocklist.isSessionRevoked('sid-123')).toBe(true);
    expect(tokenBlocklist.isSessionRevoked('other')).toBe(false);
  });

  it('ignores empty sid input', () => {
    expect(tokenBlocklist.isSessionRevoked(null)).toBe(false);
    expect(tokenBlocklist.isSessionRevoked('')).toBe(false);
    expect(() => tokenBlocklist.revokeSession(null)).not.toThrow();
  });
});

describe('Edge — shared token utils (tokenUtils)', () => {
  it('issues access+refresh with iss/aud/sid and rejects purpose confusion', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { generateTokens, signTempTwoFactorToken, hashToken } = await import(
      '../../src/modules/auth/tokenUtils.js'
    );

    const tokens = generateTokens({ id: 'u-1', role: 'customer' }, 'sess-9');
    const access = jwt.verify(tokens.accessToken, process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: 'ecommerce-pro',
      audience: 'ecommerce-pro-client',
    });
    expect(access.sid).toBe('sess-9');
    expect(access.purpose).toBeUndefined();

    const temp = signTempTwoFactorToken('u-1');
    const decoded = jwt.verify(temp, process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: 'ecommerce-pro',
      audience: 'ecommerce-pro-client',
    });
    expect(decoded.purpose).toBe('2fa');

    expect(hashToken('abc')).toMatch(/^[a-f0-9]{64}$/);
  });
});
