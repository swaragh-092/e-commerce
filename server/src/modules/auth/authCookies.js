'use strict';

const jwt = require('jsonwebtoken');
const { AUTH_TIME } = require('../../config/constants');

const ACCESS_COOKIE = 'auth_access_token';
const REFRESH_COOKIE = 'auth_refresh_token';
const TRUSTED_DEVICE_COOKIE = 'trusted_device';

const getJwtIssAud = () => ({
  issuer: process.env.JWT_ISSUER || 'ecommerce-pro',
  audience: process.env.JWT_AUDIENCE || 'ecommerce-pro-client',
});

const getCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.AUTH_COOKIE_SAMESITE || 'lax',
    path: '/',
    ...(process.env.AUTH_COOKIE_DOMAIN ? { domain: process.env.AUTH_COOKIE_DOMAIN } : {}),
});

const setAuthCookies = (res, tokens, { rememberMe = false } = {}) => {
    if (!tokens?.accessToken || !tokens?.refreshToken) return;

    const options = getCookieOptions();
    res.cookie(ACCESS_COOKIE, tokens.accessToken, {
        ...options,
        maxAge: 15 * 60 * 1000,
    });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
        ...options,
        maxAge: rememberMe ? AUTH_TIME.REMEMBER_ME_TTL_MS : AUTH_TIME.REFRESH_TOKEN_TTL_MS,
    });
};

const clearAuthCookies = (res) => {
    const options = getCookieOptions();
    res.clearCookie(ACCESS_COOKIE, options);
    res.clearCookie(REFRESH_COOKIE, options);
};

const getAccessToken = (req) => req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : req.cookies?.[ACCESS_COOKIE] || null;

const getRefreshToken = (req) => req.body?.refreshToken || req.cookies?.[REFRESH_COOKIE] || null;

const stripAuthTokens = (result) => {
    if (!result || !result.tokens) return result;
    const { tokens, ...safeResult } = result;
    return safeResult;
};

const signTrustedDevice = (userId) => {
    const { issuer, audience } = getJwtIssAud();
    return jwt.sign({ id: userId, purpose: 'trusted_device' }, process.env.JWT_ACCESS_SECRET, {
        expiresIn: '30d',
        issuer,
        audience,
    });
};

const verifyTrustedDevice = (cookieValue, userId) => {
    if (!cookieValue || !userId) return false;
    try {
        const { issuer, audience } = getJwtIssAud();
        const decoded = jwt.verify(cookieValue, process.env.JWT_ACCESS_SECRET, {
            algorithms: ['HS256'],
            issuer,
            audience,
        });
        return decoded.purpose === 'trusted_device' && decoded.id === userId;
    } catch {
        return false;
    }
};

const setTrustedDeviceCookie = (res, userId) => {
    const token = signTrustedDevice(userId);
    res.cookie(TRUSTED_DEVICE_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.AUTH_COOKIE_SAMESITE || 'lax',
        path: '/',
        ...(process.env.AUTH_COOKIE_DOMAIN ? { domain: process.env.AUTH_COOKIE_DOMAIN } : {}),
        maxAge: 30 * 24 * 60 * 60 * 1000,
    });
};

module.exports = {
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    TRUSTED_DEVICE_COOKIE,
    clearAuthCookies,
    getAccessToken,
    getRefreshToken,
    setAuthCookies,
    stripAuthTokens,
    signTrustedDevice,
    verifyTrustedDevice,
    setTrustedDeviceCookie,
};
