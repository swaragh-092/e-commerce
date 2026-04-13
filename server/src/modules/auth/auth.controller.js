'use strict';

const AuthService = require('./auth.service');
const { success, error } = require('../../utils/response');

const register = async (req, res, next) => {
  try {
    const result = await AuthService.register(req.validated);
    return success(res, result, 'Registration successful. Please check your email to verify your account.', 201);
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.validated;
    const ipAddress = req.ip;
    const result = await AuthService.login(email, password, ipAddress);
    return success(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.validated;
    const ipAddress = req.ip;
    const result = await AuthService.refresh(refreshToken, ipAddress);
    return success(res, result, 'Token refreshed');
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    await AuthService.logout(req.validated.refreshToken, req.user?.id);
    return success(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
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
    // Read from query param: ?token=xxx
    const token = req.query.token;
    if (!token) return error(res, 'Token is required', 400, 'VALIDATION_ERROR');
    
    await AuthService.verifyEmail(token);
    return success(res, null, 'Email verified successfully');
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
  verifyEmail
};
