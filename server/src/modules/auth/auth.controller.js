'use strict';

const AuthService = require('./auth.service');
const { success } = require('../../utils/response');
const tokenBlocklist = require('../../utils/tokenBlocklist');
const AppError = require('../../utils/AppError');
const {
  clearAuthCookies,
  getAccessToken,
  getRefreshToken,
  setAuthCookies,
  stripAuthTokens,
  setRememberedDeviceCookie,
  clearRememberedDeviceCookie,
  setTrustedDeviceCookie,
} = require('./authCookies');

const sendAuthSuccess = (res, result, message, options = {}) => {
  if (result?.tokens) {
    setAuthCookies(res, result.tokens, { ...options, adminSessionExpiresAt: result.adminSessionExpiresAt });
  }
  if (result?.rememberedDeviceToken) setRememberedDeviceCookie(res, result.rememberedDeviceToken);
  return success(res, stripAuthTokens(result), message);
};

const register = async (req, res, next) => {
  try {
    const result = await AuthService.register(req.validated, req.ip);
    if (result?.tokens) setAuthCookies(res, result.tokens);
    return res.status(201).json({
      success: true,
      data: stripAuthTokens(result),
      message: 'Registration successful. Please check your email to verify your account.',
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password, rememberMe } = req.validated;
    const rememberedDeviceToken = req.cookies?.remembered_device;
    const result = await AuthService.login(email, password, req.ip, rememberMe, req.headers['user-agent'], rememberedDeviceToken, req.validated.reauthContext, req.cookies?.trusted_device);
    if (result.requiresTwoFactor || result.requiresMfaEnrollment) res.setHeader('Cache-Control', 'no-store');
    return sendAuthSuccess(res, result, 'Login successful', { rememberMe: result.rememberMe ?? rememberMe });
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const refreshToken = getRefreshToken(req);
    if (!refreshToken) throw new AppError('UNAUTHORIZED', 401, 'Refresh session not found');
    const result = await AuthService.refresh(refreshToken, req.ip, req.headers['user-agent']);
    // AuthService.refresh returns { tokens, rememberMe } (or legacy bare tokens)
    const normalized = result?.tokens ? result : { tokens: result, rememberMe: false };
    return sendAuthSuccess(res, normalized, 'Token refreshed', { rememberMe: normalized.rememberMe === true });
  } catch (err) {
    if (err.code !== 'ADMIN_SESSION_EXPIRED' && (err.code === 'UNAUTHORIZED' || err.statusCode === 401)) clearAuthCookies(res);
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const refreshToken = getRefreshToken(req);
    if (refreshToken) await AuthService.logout(refreshToken, req.user?.id);
    await require('./rememberedDevice').revoke(req.cookies?.remembered_device);
    clearRememberedDeviceCookie(res);
    // Persist the session revocation so every worker rejects this access token
    // and any sibling access token from the same session.
    const accessToken = getAccessToken(req);
    if (accessToken) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET, {
          algorithms: ['HS256'],
          issuer: process.env.JWT_ISSUER || 'ecommerce-pro',
          audience: process.env.JWT_AUDIENCE || 'ecommerce-pro-client',
        });
        if (decoded.sid) {
          const { RefreshToken } = require('../index');
          await RefreshToken.update(
            { revokedAt: new Date() },
            { where: { id: decoded.sid, revokedAt: null } },
          );
          tokenBlocklist.revokeSession(decoded.sid);
        } else {
          tokenBlocklist.add(accessToken);
        }
      } catch (error) {
        // Invalid/expired JWTs are already unusable. Persistence failures must
        // reach the caller rather than report success with a live session.
        if (!['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) throw error;
      }
    }
    clearAuthCookies(res);
    return success(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  } finally {
    clearAuthCookies(res);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    await AuthService.forgotPassword(req.validated.email);
    // Always return success even if email not found
    return success(res, null, 'If an account exists with this email, a password reset link has been sent');
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.validated;
    await AuthService.resetPassword(token, newPassword);
    return success(res, null, 'Password reset successful. You can now log in.');
  } catch (err) {
    next(err);
  }
};

const resendVerification = async (req, res, next) => {
  try {
    await AuthService.resendVerification(req.validated.email);
    return success(res, null, 'If your account exists and is unverified, a verification link has been sent');
  } catch (err) {
    next(err);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.validated;
    await AuthService.verifyEmail(token);
    return success(res, null, 'Email verified successfully');
  } catch (err) {
    next(err);
  }
};

const verifyTwoFactor = async (req, res, next) => {
  try {
    const { tempToken, code, trustDevice } = req.validated;
    const ipAddress = req.ip;
    const result = await AuthService.verifyTwoFactor(tempToken, code, ipAddress);
    if (trustDevice && result.user && !require('../../config/permissions').isAdminUser(result.user)) {
      setTrustedDeviceCookie(res, result.user.id);
    }

    return sendAuthSuccess(res, result, 'Login successful', { rememberMe: result.rememberMe });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  resendVerification,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  verifyTwoFactor
};
