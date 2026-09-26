import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  getAccessToken,
  getRefreshToken,
  setAuthCookies,
  stripAuthTokens,
} = require('../../src/modules/auth/authCookies');
const { refreshSchema, logoutSchema } = require('../../src/modules/auth/auth.validation');

describe('HttpOnly auth cookies', () => {
  it('sets access and refresh cookies without exposing a browser-readable token contract', () => {
    const response = { cookie: vi.fn(), clearCookie: vi.fn() };
    const tokens = { accessToken: 'access', refreshToken: 'refresh' };

    setAuthCookies(response, tokens, { rememberMe: true });

    expect(response.cookie).toHaveBeenCalledWith(ACCESS_COOKIE, 'access', expect.objectContaining({ httpOnly: true, sameSite: 'lax' }));
    expect(response.cookie).toHaveBeenCalledWith(REFRESH_COOKIE, 'refresh', expect.objectContaining({ httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 }));
    expect(stripAuthTokens({ user: { id: 'user-1' }, tokens })).toEqual({ user: { id: 'user-1' } });
  });

  it('clears both auth cookies and prefers legacy headers/body only when present', () => {
    const response = { cookie: vi.fn(), clearCookie: vi.fn() };

    clearAuthCookies(response);

    expect(response.clearCookie).toHaveBeenCalledWith(ACCESS_COOKIE, expect.objectContaining({ httpOnly: true, path: '/' }));
    expect(response.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE, expect.objectContaining({ httpOnly: true, path: '/' }));
    expect(getAccessToken({ headers: { authorization: 'Bearer header-token' }, cookies: { [ACCESS_COOKIE]: 'cookie-token' } })).toBe('header-token');
    expect(getAccessToken({ headers: {}, cookies: { [ACCESS_COOKIE]: 'cookie-token' } })).toBe('cookie-token');
    expect(getRefreshToken({ body: { refreshToken: 'body-token' }, cookies: { [REFRESH_COOKIE]: 'cookie-token' } })).toBe('body-token');
  });

  it('allows empty refresh/logout bodies when the HttpOnly cookie carries the token', () => {
    expect(refreshSchema.validate({}).error).toBeUndefined();
    expect(logoutSchema.validate({}).error).toBeUndefined();
  });
});
