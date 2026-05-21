import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Mock environment
process.env.JWT_ACCESS_SECRET = 'test-access-secret-32chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-long!';
process.env.JWT_ISSUER = 'ecommerce-pro';
process.env.JWT_AUDIENCE = 'ecommerce-pro-client';
process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-encryption-key-32chars-lon!';

describe('Auth — Token Hashing', () => {
  const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

  it('produces a 64-char hex string', () => {
    const raw = crypto.randomBytes(32).toString('hex');
    const hashed = hashToken(raw);
    expect(hashed).toHaveLength(64);
    expect(hashed).toMatch(/^[a-f0-9]{64}$/);
  });

  it('same input always produces same hash', () => {
    const raw = 'test-token-value';
    expect(hashToken(raw)).toBe(hashToken(raw));
  });

  it('different inputs produce different hashes', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });
});

describe('Auth — JWT Claims', () => {
  it('generates tokens with iss and aud claims', () => {
    const payload = { id: 'user-123', role: 'customer' };
    const token = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: '15m',
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    });

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    });

    expect(decoded.iss).toBe('ecommerce-pro');
    expect(decoded.aud).toBe('ecommerce-pro-client');
    expect(decoded.id).toBe('user-123');
  });

  it('rejects tokens with wrong issuer', () => {
    const token = jwt.sign({ id: '1' }, process.env.JWT_ACCESS_SECRET, { issuer: 'wrong-issuer' });
    expect(() => jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: 'ecommerce-pro',
    })).toThrow();
  });

  it('rejects tokens with wrong audience', () => {
    const token = jwt.sign({ id: '1' }, process.env.JWT_ACCESS_SECRET, { audience: 'wrong-aud' });
    expect(() => jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      audience: 'ecommerce-pro-client',
    })).toThrow();
  });

  it('rejects alg:none tokens', () => {
    // Manually craft an unsigned token
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ id: '1', role: 'admin' })).toString('base64url');
    const fakeToken = `${header}.${payload}.`;

    expect(() => jwt.verify(fakeToken, process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    })).toThrow();
  });
});

describe('Auth — Token Blocklist', () => {
  let tokenBlocklist;

  beforeEach(async () => {
    // Fresh import each time
    vi.resetModules();
    tokenBlocklist = (await import('../../src/utils/tokenBlocklist.js')).default || await import('../../src/utils/tokenBlocklist.js');
  });

  it('blocks a token after adding it', () => {
    tokenBlocklist.add('token-abc');
    expect(tokenBlocklist.isBlocked('token-abc')).toBe(true);
  });

  it('does not block unknown tokens', () => {
    expect(tokenBlocklist.isBlocked('never-added')).toBe(false);
  });
});

describe('Auth — OTP Hashing', () => {
  const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

  it('hashes a 6-digit OTP to 64-char hex', () => {
    const otp = '123456';
    const hashed = hashOtp(otp);
    expect(hashed).toHaveLength(64);
    expect(hashed).toMatch(/^[a-f0-9]{64}$/);
  });

  it('different OTPs produce different hashes', () => {
    expect(hashOtp('123456')).not.toBe(hashOtp('654321'));
  });
});

describe('Auth — Password Validation (Joi schema)', () => {
  // Import the actual Joi schema
  let passwordPolicy;

  beforeEach(async () => {
    const mod = await import('../../src/modules/auth/auth.validation.js');
    passwordPolicy = mod.registerSchema;
  });

  it('rejects password without lowercase', () => {
    const { error } = passwordPolicy.validate({
      firstName: 'Test', lastName: 'User', email: 'a@b.com',
      password: 'ABCDEFG1!', confirmPassword: 'ABCDEFG1!',
    });
    expect(error).toBeTruthy();
  });

  it('rejects password without uppercase', () => {
    const { error } = passwordPolicy.validate({
      firstName: 'Test', lastName: 'User', email: 'a@b.com',
      password: 'abcdefg1!', confirmPassword: 'abcdefg1!',
    });
    expect(error).toBeTruthy();
  });

  it('rejects password without symbol', () => {
    const { error } = passwordPolicy.validate({
      firstName: 'Test', lastName: 'User', email: 'a@b.com',
      password: 'Abcdefg1', confirmPassword: 'Abcdefg1',
    });
    expect(error).toBeTruthy();
  });

  it('rejects password shorter than 8 chars', () => {
    const { error } = passwordPolicy.validate({
      firstName: 'Test', lastName: 'User', email: 'a@b.com',
      password: 'Ab1!xyz', confirmPassword: 'Ab1!xyz',
    });
    expect(error).toBeTruthy();
  });

  it('accepts valid password', () => {
    const { error } = passwordPolicy.validate({
      firstName: 'Test', lastName: 'User', email: 'a@b.com',
      password: 'Abcdefg1!', confirmPassword: 'Abcdefg1!',
    });
    expect(error).toBeFalsy();
  });

  it('rejects mismatched confirmPassword', () => {
    const { error } = passwordPolicy.validate({
      firstName: 'Test', lastName: 'User', email: 'a@b.com',
      password: 'Abcdefg1!', confirmPassword: 'Different1!',
    });
    expect(error).toBeTruthy();
  });
});
