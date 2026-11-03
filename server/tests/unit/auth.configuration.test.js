import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const redirects = require('../../src/modules/auth/authRedirects');
const cookies = require('../../src/modules/auth/authCookies');
afterEach(() => vi.unstubAllEnvs());
describe('Authentication configuration safety', () => {
  it('uses one configured frontend URL even when CORS has several local origins', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CLIENT_URL', 'http://localhost:3000/,http://localhost:5173');
    expect(redirects.getClientBaseUrl()).toBe('http://localhost:3000');
  });
  it.each(['javascript:alert(1)', 'https://' + 'name:password' + '@example.com', 'https://example.com?next=evil', 'https://example.com/#fragment'])('rejects unsafe redirect base %s', value => {
    vi.stubEnv('CLIENT_URL', value);
    expect(() => redirects.getClientBaseUrl()).toThrow();
  });
  it('requires configured HTTPS URLs in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CLIENT_URL', '');
    expect(() => redirects.getClientBaseUrl()).toThrow();
    vi.stubEnv('CLIENT_URL', 'http://example.com');
    expect(() => redirects.getClientBaseUrl()).toThrow();
    vi.stubEnv('SERVER_URL', 'https://example.com/');
    expect(redirects.getGoogleCallbackUrl()).toBe('https://example.com/api/auth/google/callback');
  });
  it('does not sign trusted-device tokens with a default secret', () => {
    vi.stubEnv('JWT_ACCESS_SECRET', '');
    expect(() => cookies.createTrustedDeviceToken('user')).toThrow();
    expect(() => cookies.encrypt('test')).toThrow();
    expect(cookies.verifyTrustedDevice('untrusted', 'user')).toBe(false);
  });
  it('requires Secure cookies with SameSite=None and rejects unknown SameSite settings', () => {
    const response = { cookie: vi.fn() };
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AUTH_COOKIE_SAMESITE', 'None');
    cookies.setAuthCookies(response, { accessToken: 'a', refreshToken: 'r' });
    expect(response.cookie.mock.calls[0][2]).toMatchObject({ secure: true, httpOnly: true, sameSite: 'none' });
    vi.stubEnv('AUTH_COOKIE_SAMESITE', 'invalid');
    expect(() => cookies.setAuthCookies(response, { accessToken: 'a', refreshToken: 'r' })).toThrow();
  });
});
