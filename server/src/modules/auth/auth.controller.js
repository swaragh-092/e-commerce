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
} = require('./authCookies');

const sendAuthSuccess = (res, result, message, options = {}) => {
  if (result?.tokens) {
    setAuthCookies(res, result.tokens, options);
  }
  return success(res, stripAuthTokens(result), message);
};

const register = async (req, res, next) => {
  try {
    const result = await AuthService.register(req.validated);
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
    const trustedDevice = req.cookies?.trusted_device;
    const result = await AuthService.login(email, password, req.ip, rememberMe, req.headers['user-agent'], trustedDevice);
    return sendAuthSuccess(res, result, 'Login successful', { rememberMe });
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const refreshToken = getRefreshToken(req);
    if (!refreshToken) throw new AppError('UNAUTHORIZED', 401, 'Refresh session not found');
    const result = await AuthService.refresh(refreshToken, req.ip, req.headers['user-agent']);
    return sendAuthSuccess(res, result, 'Token refreshed');
  } catch (err) {
    if (err.code === 'UNAUTHORIZED' || err.statusCode === 401) clearAuthCookies(res);
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const refreshToken = getRefreshToken(req);
    if (refreshToken) await AuthService.logout(refreshToken, req.user?.id);
    // Blocklist the current access token for its remaining lifetime
    const accessToken = getAccessToken(req);
    if (accessToken) tokenBlocklist.add(accessToken);
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

    // Set trusted device cookie if requested (30 days)
    if (trustDevice) {
      const crypto = require('crypto');
      const deviceId = crypto.createHash('sha256').update(`${result.user.id}:${req.headers['user-agent']}:${ipAddress}`).digest('hex').slice(0, 32);
      res.cookie('trusted_device', deviceId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }

    return sendAuthSuccess(res, result, 'Login successful');
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
