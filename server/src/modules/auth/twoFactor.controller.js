'use strict';

const TwoFactorService = require('./twoFactor.service');
const { success } = require('../../utils/response');
const { setAuthCookies, stripAuthTokens } = require('./authCookies');
const { verifyMfaEnrollmentToken } = require('./tokenUtils');
const AppError = require('../../utils/AppError');

const enrollmentClaims = (token) => {
  try { return verifyMfaEnrollmentToken(token); }
  catch { throw new AppError('UNAUTHORIZED', 401, 'MFA enrollment has expired. Sign in again to continue.'); }
};

const setup = async (req, res, next) => {
  try {
    const result = await TwoFactorService.setup(req.user.id);
    return success(res, result, '2FA setup initiated. Scan the QR code and verify.');
  } catch (err) { next(err); }
};

const enable = async (req, res, next) => {
  try {
    const result = await TwoFactorService.enable(req.user.id, req.validated.code, { createSession: true, ipAddress: req.ip });
    setAuthCookies(res, result.tokens);
    return success(res, stripAuthTokens(result), '2FA enabled successfully');
  } catch (err) { next(err); }
};

const enrollmentSetup = async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const claims = enrollmentClaims(req.validated.enrollmentToken);
    const result = await TwoFactorService.setup(claims.id);
    return success(res, result, 'Authenticator setup initiated. Scan the QR code and verify.');
  } catch (err) { next(err); }
};

const enrollmentEnable = async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const claims = enrollmentClaims(req.validated.enrollmentToken);
    const result = await TwoFactorService.enable(claims.id, req.validated.code, { createSession: true, ipAddress: req.ip });
    setAuthCookies(res, result.tokens);
    return success(res, stripAuthTokens(result), 'Authenticator enabled successfully');
  } catch (err) { next(err); }
};

const disable = async (req, res, next) => {
  try {
    const result = await TwoFactorService.disable(req.user.id, req.validated.code, { createSession: true, ipAddress: req.ip });
    setAuthCookies(res, result.tokens);
    return success(res, stripAuthTokens(result), '2FA disabled successfully');
  } catch (err) { next(err); }
};

const regenerateBackupCodes = async (req, res, next) => {
  try {
    const result = await TwoFactorService.regenerateBackupCodes(req.user.id, req.validated.code);
    return success(res, result, 'New backup codes generated. Save them securely.');
  } catch (err) { next(err); }
};

module.exports = { setup, enable, enrollmentSetup, enrollmentEnable, disable, regenerateBackupCodes };
