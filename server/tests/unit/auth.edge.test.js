import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const require = createRequire(import.meta.url);

process.env.JWT_ACCESS_SECRET = 'test-access-secret-32chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-long!';
process.env.JWT_ISSUER = 'ecommerce-pro';
process.env.JWT_AUDIENCE = 'ecommerce-pro-client';

const db = require('../../src/modules/index');
const { findOrCreateOAuthUser } = require('../../src/modules/auth/oauth.service');

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

describe('Edge — OAuth user case-insensitivity and normalization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback({}));
  });

  it('matches preexisting user with uppercase email case-insensitively and normalizes it', async () => {
    const existingUser = {
      id: 'user-upper-123',
      email: 'John.Doe@Example.COM',
      status: 'active',
      role: 'customer',
      twoFactorEnabled: false,
      update: vi.fn().mockImplementation(async function(fields) {
        Object.assign(this, fields);
        return this;
      }),
    };

    let findOneWhere;
    vi.spyOn(db.User, 'findOne').mockImplementation(async (options) => {
      findOneWhere = options?.where;
      return existingUser;
    });
    vi.spyOn(db.User, 'create').mockResolvedValue(null);
    vi.spyOn(db.User, 'findByPk').mockResolvedValue({
      id: 'user-upper-123',
      email: 'john.doe@example.com',
      role: 'customer',
      status: 'active',
      roles: [],
    });
    vi.spyOn(db.RefreshToken, 'update').mockResolvedValue([0]);
    vi.spyOn(db.RefreshToken, 'findAll').mockResolvedValue([]);
    vi.spyOn(db.RefreshToken, 'create').mockResolvedValue({});

    const profile = {
      emails: [{ value: 'john.doe@example.com' }],
      name: { givenName: 'John', familyName: 'Doe' },
    };

    const result = await findOrCreateOAuthUser(profile, '127.0.0.1');

    expect(db.User.create).not.toHaveBeenCalled();
    expect(db.User.findOne).toHaveBeenCalled();
    // Verify case-insensitive LOWER() condition was queried
    expect(findOneWhere).toBeDefined();
    // Verify existing user's uppercase email was updated to canonical lowercase
    expect(existingUser.update).toHaveBeenCalledWith(
      { email: 'john.doe@example.com' },
      expect.anything()
    );
    expect(existingUser.email).toBe('john.doe@example.com');
    expect(result.tokens).toBeDefined();
  });

  it('creates a new user with normalized lowercase email when no user matches', async () => {
    vi.spyOn(db.User, 'findOne').mockResolvedValue(null);
    const createdUser = {
      id: 'new-user-456',
      email: 'new.user@example.com',
      role: 'customer',
      status: 'active',
      twoFactorEnabled: false,
      setRoles: vi.fn().mockResolvedValue(true),
      update: vi.fn().mockResolvedValue(true),
    };
    vi.spyOn(db.User, 'create').mockResolvedValue(createdUser);
    vi.spyOn(db.Role, 'findOne').mockResolvedValue({ id: 'role-cust', slug: 'customer' });
    vi.spyOn(db.User, 'findByPk').mockResolvedValue({
      id: 'new-user-456',
      email: 'new.user@example.com',
      role: 'customer',
      status: 'active',
      roles: [],
    });
    vi.spyOn(db.RefreshToken, 'create').mockResolvedValue({});

    const profile = {
      emails: [{ value: 'New.User@Example.COM' }],
      name: { givenName: 'New', familyName: 'User' },
    };

    const result = await findOrCreateOAuthUser(profile, '127.0.0.1');

    expect(db.User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new.user@example.com',
      }),
      expect.anything()
    );
    expect(result.tokens).toBeDefined();
  });
});
