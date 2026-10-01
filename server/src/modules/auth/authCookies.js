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

const crypto = require('crypto');

const getEncryptionKey = () => {
    const secret = process.env.JWT_ACCESS_SECRET || 'default-fallback-jwt-secret-min-32-chars';
    return crypto.createHash('sha256').update(secret).digest();
};

const encryptPayload = (plainText) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

const decryptPayload = (encryptedText) => {
    try {
        const parts = String(encryptedText || '').split(':');
        if (parts.length !== 3) return null;
        const [ivHex, authTagHex, dataHex] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(dataHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch {
        return null;
    }
};

const getJwtSecret = () => process.env.JWT_ACCESS_SECRET || 'jwt-default-access-secret-32-chars-long';

const signTrustedDevice = (userId) => {
    const { issuer, audience } = getJwtIssAud();
    const token = jwt.sign({ id: userId, purpose: 'trusted_device' }, getJwtSecret(), {
        expiresIn: '30d',
        issuer,
        audience,
    });
    return encryptPayload(token);
};

const verifyTrustedDevice = (cookieValue, userId) => {
    if (!cookieValue || !userId) return false;
    try {
        const decrypted = decryptPayload(cookieValue) || cookieValue;
        const { issuer, audience } = getJwtIssAud();
        const decoded = jwt.verify(decrypted, getJwtSecret(), {
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
    const encryptedCookie = signTrustedDevice(userId);
    res.cookie(TRUSTED_DEVICE_COOKIE, encryptedCookie, {
        httpOnly: true,
        secure: true,
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
