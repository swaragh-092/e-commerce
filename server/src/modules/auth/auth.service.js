'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sequelize } = require('../../config/database');
const { User, RefreshToken, PasswordResetToken, EmailVerificationToken, UserProfile } = require('../../models');
const AppError = require('../../utils/AppError');
const NotificationService = require('../notification/notification.service');
const AuditService = require('../audit/audit.service');

const generateTokens = (user) => {
  const payload = { id: user.id, role: user.role };
  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' });
  return { accessToken, refreshToken };
};

const register = async (payload) => {
  return sequelize.transaction(async (t) => {
    // Check if email exists
    const existingUser = await User.findOne({ where: { email: payload.email }, transaction: t });
    if (existingUser) {
      throw new AppError('VALIDATION_ERROR', 400, 'User with this email already exists');
    }

    // Create User & Profile
    const user = await User.create({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      password: payload.password, // model hook will hash this
      role: 'customer',
      status: 'active'
    }, { transaction: t });

    // Explicitly create profile (if it doesn't auto-create via hooks)
    if (UserProfile) {
        await UserProfile.create({ userId: user.id }, { transaction: t });
    }

    // Generate Verification Token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    await EmailVerificationToken.create({
      userId: user.id,
      token: verifyToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    }, { transaction: t });

    // Send Welcome & Verification Email
    try {
        if (NotificationService && NotificationService.send) {
            await NotificationService.send('verify_email', user.email, {
                name: user.firstName,
                verify_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email?token=${verifyToken}`
            }, user.id, null, t);
        }
    } catch (e) {
        // Log but don't fail registration
    }

    // Generate JWTs
    const tokens = generateTokens(user);

    // Save refresh token
    await RefreshToken.create({
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdByIp: 'registration'
    }, { transaction: t });

    return { user: user.toJSON(), tokens }; // password is excluded via defaultScope
  });
};

const login = async (email, password, ipAddress) => {
  const user = await User.scope('withPassword').findOne({ where: { email } });
  
  if (!user || !(await user.validatePassword(password))) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid email or password');
  }

  if (user.status !== 'active') {
    throw new AppError('FORBIDDEN', 403, 'Your account is inactive or banned');
  }

  // Generate tokens
  const tokens = generateTokens(user);

  // Save refresh token
  await RefreshToken.create({
    userId: user.id,
    token: tokens.refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    createdByIp: ipAddress
  });

  // Load user data without password for response
  const userData = await User.findByPk(user.id);
  
  // Try audit log
  try {
      if (AuditService && AuditService.log) {
          await AuditService.log({
              userId: user.id,
              action: 'LOGIN',
              entity: 'User',
              entityId: user.id,
              ipAddress
          });
      }
  } catch(e) {}

  return { user: userData.toJSON(), tokens };
};

const refresh = async (refreshTokenStr, ipAddress) => {
  try {
    const decoded = jwt.verify(refreshTokenStr, process.env.JWT_REFRESH_SECRET);
    const tokenRecord = await RefreshToken.findOne({ where: { token: refreshTokenStr } });

    if (!tokenRecord || tokenRecord.revokedAt) {
      throw new Error('Token revoked');
    }

    const user = await User.findByPk(decoded.id);
    if (!user || user.status !== 'active') {
      throw new Error('User inactive');
    }

    const { accessToken } = generateTokens(user);
    
    // In a strict implementation, we would rotate the refresh token here too
    // For Phase 1, just returning a new access token is sufficient.

    return { accessToken };
  } catch (err) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid or expired refresh token');
  }
};

const logout = async (refreshTokenStr, userId) => {
  const tokenRecord = await RefreshToken.findOne({ where: { token: refreshTokenStr, userId } });
  if (tokenRecord) {
    await tokenRecord.destroy(); // Hard delete or you could soft delete / set revokedAt
  }
  
  try {
      if (AuditService && AuditService.log) {
          await AuditService.log({
              userId: userId,
              action: 'LOGOUT',
              entity: 'User',
              entityId: userId
          });
      }
  } catch(e) {}
};

const forgotPassword = async (email) => {
  const user = await User.findOne({ where: { email } });
  if (!user) return; // Silent return for security (don't reveal if email exists)

  return sequelize.transaction(async (t) => {
    // Delete any existing unused tokens for this user
    await PasswordResetToken.destroy({ where: { userId: user.id }, transaction: t });

    const resetToken = crypto.randomBytes(32).toString('hex');
    await PasswordResetToken.create({
      userId: user.id,
      token: resetToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 mins
    }, { transaction: t });

    try {
        if (NotificationService && NotificationService.send) {
            await NotificationService.send('password_reset', user.email, {
                name: user.firstName,
                reset_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`
            }, user.id, null, t);
        }
    } catch (e) {}
  });
};

const resetPassword = async (token, newPassword) => {
  return sequelize.transaction(async (t) => {
    const resetRecord = await PasswordResetToken.findOne({ where: { token }, transaction: t });
    
    if (!resetRecord || resetRecord.expiresAt < new Date()) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid or expired reset token');
    }

    const user = await User.findByPk(resetRecord.userId, { transaction: t });
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

    await user.update({ password: newPassword }, { transaction: t });
    await resetRecord.destroy({ transaction: t }); // Delete token after use
    
    // Revoke all existing refresh tokens so they have to log in anew
    await RefreshToken.destroy({ where: { userId: user.id }, transaction: t });
  });
};

const verifyEmail = async (token) => {
  return sequelize.transaction(async (t) => {
    const verifyRecord = await EmailVerificationToken.findOne({ where: { token }, transaction: t });
    
    if (!verifyRecord || verifyRecord.expiresAt < new Date()) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid or expired verification token');
    }

    const user = await User.findByPk(verifyRecord.userId, { transaction: t });
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

    await user.update({ emailVerified: true }, { transaction: t });
    await verifyRecord.destroy({ transaction: t });
  });
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail
};
