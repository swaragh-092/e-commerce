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
    it('accepts public form submissions while protecting account and admin writes', () => {
        const headers = { Origin: 'https://shop.example' };
        const cookies = { auth_access_token: 'session' };
        for (const path of ['/enquiries', '/Enquiries/', '/contact', '/newsletter/subscribe']) {
            expect(check({ path, cookies, headers })).toBeUndefined();
        }
        for (const path of ['/enquiries/admin', '/newsletter/campaigns', '/newsletter/me']) {
            expect(check({ path, cookies, headers })).toMatchObject({ code: 'CSRF_TOKEN_INVALID' });
        }
        expect(check({ method: 'PUT', path: '/enquiries', cookies, headers })).toMatchObject({ code: 'CSRF_TOKEN_INVALID' });
    });
    it('allows email clients to submit one-click unsubscribe', () => {
        const headers = { Origin: 'https://mail.example' };
        expect(check({ path: '/newsletter/unsubscribe/one-click', headers })).toBeUndefined();
        expect(check({ path: '/newsletter/unsubscribe', headers })).toMatchObject({ code: 'CSRF_TOKEN_INVALID' });
    });
    it('allows static storefront wishlist writes with an explicit guest session', () => {
        const headers = { Origin: 'https://shop.example', 'X-Session-Id': '7ea64a5a-ecac-4872-901a-db28b3d35ac8' };
        expect(check({ path: '/wishlist/items', headers })).toBeUndefined();
        expect(check({ method: 'DELETE', path: '/wishlist/items', headers })).toBeUndefined();
        expect(check({ method: 'DELETE', path: '/wishlist/items/product-id', headers })).toBeUndefined();
        expect(check({ path: '/wishlist/items', headers, cookies: { auth_access_token: 'session' } })).toMatchObject({ code: 'CSRF_TOKEN_INVALID' });
        expect(check({ path: '/wishlist/items', headers: { ...headers, Authorization: 'Bearer session' } })).toMatchObject({ code: 'CSRF_TOKEN_INVALID' });
        expect(check({ path: '/wishlist/items', headers: { ...headers, 'X-Session-Id': 'invalid' } })).toMatchObject({ code: 'CSRF_TOKEN_INVALID' });
        expect(check({ path: '/wishlist/merge', headers })).toMatchObject({ code: 'CSRF_TOKEN_INVALID' });
    });
});
