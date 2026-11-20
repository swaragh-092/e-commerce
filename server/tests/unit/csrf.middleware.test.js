import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { csrfToken, verifyCsrf } = require('../../src/middleware/csrf.middleware');

const token = 'ab'.repeat(32);
const check = ({ method = 'POST', path = '/gift-cards/admin/issue', cookies = {}, headers = {} } = {}) => {
    const next = vi.fn();
    verifyCsrf({ method, path, cookies, get: (name) => headers[name] }, {}, next);
    return next.mock.calls[0][0];
};

describe('browser CSRF protection', () => {
    it('issues a random token with a private non-cacheable response and reuses it', () => {
        const res = { cookie: vi.fn(), set: vi.fn(), json: vi.fn() };
        csrfToken({ cookies: {} }, res);
        const [name, value, options] = res.cookie.mock.calls[0];
        expect(value).toMatch(/^[a-f0-9]{64}$/);
        expect(options).toMatchObject({ httpOnly: true, path: '/' });
        expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
        csrfToken({ cookies: { [name]: value } }, res);
        expect(res.cookie).toHaveBeenCalledTimes(1);
        expect(res.json).toHaveBeenLastCalledWith({ token: value });
    });
    it('requires a matching token for browser writes and cookie-authenticated writes', () => {
        expect(check({ cookies: { auth_access_token: 'session' } })).toMatchObject({ code: 'CSRF_TOKEN_INVALID' });
        expect(check({ headers: { Origin: 'https://other.example' } })).toMatchObject({ code: 'CSRF_TOKEN_INVALID' });
        expect(check({ cookies: { csrf_token: token }, headers: { 'X-CSRF-Token': token, Origin: 'https://shop.example' } })).toBeUndefined();
        expect(check({ cookies: { csrf_token: [token] }, headers: { Origin: 'https://shop.example', 'X-CSRF-Token': token } })).toMatchObject({ code: 'CSRF_TOKEN_INVALID' });
    });
    it('allows reads, provider callbacks and cookieless server requests', () => {
        expect(check({ method: 'GET', cookies: { auth_access_token: 'session' } })).toBeUndefined();
        expect(check({ path: '/payments/payu/return', headers: { Origin: 'https://payu.example' } })).toBeUndefined();
        expect(check({ path: '/payments/webhook' })).toBeUndefined();
    });
});
