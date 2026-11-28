'use strict';

const { randomBytes, timingSafeEqual } = require('node:crypto');
const AppError = require('../utils/AppError');
const { isGuestSessionId } = require('../utils/guestSession');
const { ACCESS_COOKIE, REFRESH_COOKIE, TRUSTED_DEVICE_COOKIE, REMEMBERED_DEVICE_COOKIE } = require('../modules/auth/authCookies');

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
// These submissions do not use the browser's session credentials.
const publicPostPaths = new Set([
    '/enquiries',
    '/contact',
    '/newsletter/subscribe',
    '/analytics/events/page-view',
    // Mail providers authorize one-click unsubscribe with the link token.
    '/newsletter/unsubscribe/one-click',
]);
const authCookies = [ACCESS_COOKIE, REFRESH_COOKIE, TRUSTED_DEVICE_COOKIE, REMEMBERED_DEVICE_COOKIE, 'sessionId'];
const tokenFormat = /^[a-f0-9]{64}$/;
const isToken = (value) => typeof value === 'string' && tokenFormat.test(value);
const verifyToken = (cookie, header) => isToken(cookie) && isToken(header) &&
    timingSafeEqual(Buffer.from(cookie, 'hex'), Buffer.from(header, 'hex'));
const cookieName = () => process.env.NODE_ENV === 'production' ? '__Host-csrf_token' : 'csrf_token';
const hasSessionCookie = (req) => authCookies.some((name) => req.cookies?.[name]);

function csrfToken(req, res) {
    const existingToken = req.cookies?.[cookieName()];
    const token = isToken(existingToken) ? existingToken : randomBytes(32).toString('hex');
    if (token !== existingToken) {
        const sameSite = (process.env.AUTH_COOKIE_SAMESITE || 'lax').toLowerCase();
        res.cookie(cookieName(), token, {
            httpOnly: true, sameSite, secure: process.env.NODE_ENV === 'production' || sameSite === 'none', path: '/',
        });
    }
    res.set('Cache-Control', 'no-store');
    res.json({ token });
}

function verifyCsrf(req, res, next) {
    if (safeMethods.has(req.method)) return next();
    const path = req.path.toLowerCase().replace(/\/$/, '');
    if (req.method === 'POST' && publicPostPaths.has(path)) return next();
    // The provider posts a signed payment result and ignores session credentials.
    if (req.method === 'POST' && req.path === '/payments/payu/return') return next();
    const wishlistWrite = (req.method === 'POST' && path === '/wishlist/items') ||
        (req.method === 'DELETE' && /^\/wishlist\/items(?:\/[^/]+)?$/.test(path));
    // The static storefront sends an explicit guest session ID for wishlist writes.
    if (wishlistWrite && !hasSessionCookie(req) && !req.get('Authorization') && isGuestSessionId(req.get('X-Session-Id'))) {
        return next();
    }
    return verifySessionCsrf(req, res, next);
}

function verifySessionCsrf(req, res, next) {
    const browserRequest = req.get('Origin') || req.get('Sec-Fetch-Site');
    if (!browserRequest && !hasSessionCookie(req)) return next();

    const header = req.get('X-CSRF-Token');
    const valid = process.env.NODE_ENV === 'production'
        ? verifyToken(req.cookies?.['__Host-csrf_token'], header)
        : verifyToken(req.cookies?.csrf_token, header);
    if (valid) return next();
    return next(new AppError('CSRF_TOKEN_INVALID', 403, 'Refresh the security token and try again.'));
}

module.exports = { csrfToken, verifyCsrf, verifySessionCsrf };
