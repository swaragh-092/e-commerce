'use strict';

const { AUTH_TIME } = require('../../config/constants');

const ACCESS_COOKIE = 'auth_access_token';
const REFRESH_COOKIE = 'auth_refresh_token';

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

module.exports = {
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    clearAuthCookies,
    getAccessToken,
    getRefreshToken,
    setAuthCookies,
    stripAuthTokens,
};
