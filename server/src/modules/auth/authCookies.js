'use strict';

const { AUTH_TIME } = require('../../config/constants');

const ACCESS_COOKIE = 'auth_access_token';
const REFRESH_COOKIE = 'auth_refresh_token';
const TRUSTED_DEVICE_COOKIE = 'trusted_device';
const REMEMBERED_DEVICE_COOKIE = 'remembered_device';

const getCookieOptions = () => {
    const sameSite = (process.env.AUTH_COOKIE_SAMESITE || 'lax').toLowerCase();
    if (!['lax', 'strict', 'none'].includes(sameSite)) throw new Error('Invalid AUTH_COOKIE_SAMESITE setting');
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
        sameSite,
        path: '/',
        ...(process.env.AUTH_COOKIE_DOMAIN ? { domain: process.env.AUTH_COOKIE_DOMAIN } : {}),
    };
};

const setAuthCookies = (res, tokens, { rememberMe = false, adminSessionExpiresAt } = {}) => {
    if (!tokens?.accessToken || !tokens?.refreshToken) return;

    const options = getCookieOptions();
    res.cookie(ACCESS_COOKIE, tokens.accessToken, {
        ...options,
        maxAge: 15 * 60 * 1000,
    });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
        ...options,
        maxAge: adminSessionExpiresAt
          ? Math.max(0, +new Date(adminSessionExpiresAt) - Date.now())
          : (rememberMe ? AUTH_TIME.REMEMBER_ME_TTL_MS : AUTH_TIME.REFRESH_TOKEN_TTL_MS),
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
    if (!result) return result;
    const { tokens, rememberedDeviceToken, ...safeResult } = result;
    return safeResult;
};

const setRememberedDeviceCookie = (res, token) => {
    if (!token) return;
    res.cookie(REMEMBERED_DEVICE_COOKIE, token, { ...getCookieOptions(), maxAge: 30 * 24 * 60 * 60 * 1000 });
};
const clearRememberedDeviceCookie = res => res.clearCookie(REMEMBERED_DEVICE_COOKIE, getCookieOptions());
const clearTrustedDeviceCookie = res => res.clearCookie(TRUSTED_DEVICE_COOKIE, getCookieOptions());

const verifyTrustedDevice = async (cookieValue, userId) => {
    if (!cookieValue || !userId) return false;
    try {
        return await require('./rememberedDevice').recognize(cookieValue, userId);
    } catch {
        return false;
    }
};

const setTrustedDeviceCookie = async (res, userId) => {
    const token = await require('./rememberedDevice').issue(userId);
    res.cookie(TRUSTED_DEVICE_COOKIE, token, {
        ...getCookieOptions(),
        secure: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
    });
};

module.exports = {
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    TRUSTED_DEVICE_COOKIE,
    REMEMBERED_DEVICE_COOKIE,
    clearAuthCookies,
    getAccessToken,
    getRefreshToken,
    setAuthCookies,
    stripAuthTokens,
    verifyTrustedDevice,
    setTrustedDeviceCookie,
    clearTrustedDeviceCookie,
    setRememberedDeviceCookie,
    clearRememberedDeviceCookie,
};

