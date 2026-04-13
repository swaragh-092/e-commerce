'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sequelize, User, RefreshToken, PasswordResetToken, EmailVerificationToken, UserProfile, Role, Permission } = require('../index');
const { Transaction } = require('sequelize');
const AppError = require('../../utils/AppError');
const NotificationService = require('../notification/notification.service');
const AuditService = require('../audit/audit.service');
const { ACTIONS, AUTH_TIME, ENTITIES } = require('../../config/constants');
const { enrichUserAuthorization } = require('../../config/permissions');
const logger = require('../../utils/logger');

const authUserInclude = [
  {
    model: Role,
    as: 'roles',
    through: { attributes: [] },
    include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
  },
];

const getRefreshTokenExpiryDate = () => new Date(Date.now() + AUTH_TIME.REFRESH_TOKEN_TTL_MS);

const isEmailVerificationRequired = async () => {
  try {
    const SettingsService = require('../settings/settings.service');
    const features = await SettingsService.getByGroup('features');
    return features?.emailVerification === true;
  } catch (error) {
    return false;
  }
};

const generateTokens = (user) => {
  const payload = { id: user.id, role: user.role };
  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' });
  return { accessToken, refreshToken };
};

const register = async (payload) => {
  const registrationResult = await sequelize.transaction(async (t) => {
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

    const customerRole = await Role.findOne({ where: { slug: 'customer' }, transaction: t });
    if (customerRole) {
      await user.setRoles([customerRole], { transaction: t });
    }

    // Explicitly create profile (if it doesn't auto-create via hooks)
    if (UserProfile) {
        await UserProfile.create({ userId: user.id }, { transaction: t });
    }

    // Generate Verification Token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    await EmailVerificationToken.create({
      userId: user.id,
      token: verifyToken,
      expiresAt: new Date(Date.now() + AUTH_TIME.EMAIL_VERIFICATION_TTL_MS)
    }, { transaction: t });

    // Generate JWTs
    const tokens = generateTokens(user);

    // Save refresh token
    await RefreshToken.create({
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: getRefreshTokenExpiryDate(),
      createdByIp: 'registration'
    }, { transaction: t });

    return {
      user: enrichUserAuthorization(user),
      tokens,
      verificationEmail: {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        verifyToken,
      },
    };
  });

  try {
    if (NotificationService && NotificationService.send) {
      await NotificationService.send('verify_email', registrationResult.verificationEmail.email, {
        name: registrationResult.verificationEmail.firstName,
        verify_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email?token=${registrationResult.verificationEmail.verifyToken}`
      }, registrationResult.verificationEmail.userId);
    }
  } catch (e) {
    logger.error('Registration verification email failed', {
      userId: registrationResult.verificationEmail.userId,
      operation: 'NotificationService.send.verify_email',
      errorMessage: e.message,
      stack: e.stack,
    });
  }

  try {
    if (AuditService && AuditService.log) {
      await AuditService.log({
        userId: registrationResult.user.id,
        action: ACTIONS.CREATE,
        entity: ENTITIES.USER,
        entityId: registrationResult.user.id,
      });
    }
  } catch (e) {
    logger.error('Registration audit log failed', {
      userId: registrationResult.user.id,
      operation: 'AuditService.log.registration',
      errorMessage: e.message,
      stack: e.stack,
    });
  }

  return registrationResult;
};

const login = async (email, password, ipAddress) => {
  const user = await User.scope('withPassword').findOne({
    where: { email },
    include: authUserInclude,
  });

  if (!user || !(await user.validatePassword(password))) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid email or password');
  }

  if (user.status !== 'active') {
    throw new AppError('FORBIDDEN', 403, 'Your account is inactive or banned');
  }

  if (await isEmailVerificationRequired()) {
    if (!user.emailVerified) {
      throw new AppError('FORBIDDEN', 403, 'Please verify your email before logging in');
    }
  }

  // Generate tokens
  const tokens = generateTokens(user);

  // Save refresh token
  await RefreshToken.create({
    userId: user.id,
    token: tokens.refreshToken,
    expiresAt: getRefreshTokenExpiryDate(),
    createdByIp: ipAddress
  });

  // Update lastLoginAt and load user data without password for response
  await user.update({ lastLoginAt: new Date() });
  const userData = await User.findByPk(user.id, { include: authUserInclude });
  
  // Try audit log
  try {
      if (AuditService && AuditService.log) {
          await AuditService.log({
              userId: user.id,
              action: ACTIONS.LOGIN,
              entity: ENTITIES.USER,
              entityId: user.id,
              ipAddress
          });
      }
  } catch(e) {}

  return { user: enrichUserAuthorization(userData), tokens };
};

const refresh = async (refreshTokenStr, ipAddress) => {
  try {
    const decoded = jwt.verify(refreshTokenStr, process.env.JWT_REFRESH_SECRET);
    const emailVerificationRequired = await isEmailVerificationRequired();

    return sequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
      async (t) => {
        const tokenRecord = await RefreshToken.findOne({
          where: { token: refreshTokenStr },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
          throw new AppError('UNAUTHORIZED', 401, 'Token revoked');
        }

        const user = await User.findByPk(decoded.id, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!user || user.status !== 'active') {
          throw new AppError('FORBIDDEN', 403, 'User inactive');
        }

        if (emailVerificationRequired) {
          if (!user.emailVerified) {
            throw new AppError('FORBIDDEN', 403, 'Please verify your email before logging in');
          }
        }

        const tokens = generateTokens(user);

        await tokenRecord.update({ revokedAt: new Date() }, { transaction: t });
        await RefreshToken.create({
          userId: user.id,
          token: tokens.refreshToken,
          expiresAt: getRefreshTokenExpiryDate(),
          createdByIp: ipAddress,
        }, { transaction: t });

        try {
          if (AuditService && AuditService.log) {
            await AuditService.log({
              userId: user.id,
              action: ACTIONS.REFRESH,
              entity: ENTITIES.USER,
              entityId: user.id,
              ipAddress,
            });
          }
        } catch (e) {
          logger.error('Refresh audit log failed', {
            userId: user.id,
            operation: 'AuditService.log.refresh',
            errorMessage: e.message,
            stack: e.stack,
          });
        }

        return tokens;
      }
    );
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('UNAUTHORIZED', 401, 'Invalid or expired refresh token');
  }
};

const logout = async (refreshTokenStr, userId) => {
  const tokenRecord = await RefreshToken.findOne({ where: { token: refreshTokenStr } });
  if (tokenRecord) {
    if (userId && tokenRecord.userId !== userId) {
      throw new AppError('FORBIDDEN', 403, 'You do not have permission to revoke this token');
    }

    await tokenRecord.update({ revokedAt: new Date() });
  }
  
  try {
      if (AuditService && AuditService.log) {
          await AuditService.log({
              userId: userId || tokenRecord?.userId,
              action: ACTIONS.LOGOUT,
              entity: ENTITIES.USER,
              entityId: userId || tokenRecord?.userId
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
      expiresAt: new Date(Date.now() + AUTH_TIME.PASSWORD_RESET_TTL_MS)
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

    try {
      if (AuditService && AuditService.log) {
        await AuditService.log({
          userId: user.id,
          action: ACTIONS.PASSWORD_RESET,
          entity: ENTITIES.USER,
          entityId: user.id,
        });
      }
    } catch (e) {}
  });
};

const resendVerification = async (email) => {
  return sequelize.transaction(async (t) => {
    const user = await User.findOne({ where: { email }, transaction: t });
    if (!user) return; // Silent return for security

    if (user.emailVerified) {
      throw new AppError('VALIDATION_ERROR', 400, 'Email is already verified');
    }

    await EmailVerificationToken.destroy({ where: { userId: user.id }, transaction: t });

    const verifyToken = crypto.randomBytes(32).toString('hex');
    await EmailVerificationToken.create({
      userId: user.id,
      token: verifyToken,
      expiresAt: new Date(Date.now() + AUTH_TIME.EMAIL_VERIFICATION_TTL_MS)
    }, { transaction: t });

    try {
        if (NotificationService && NotificationService.send) {
            await NotificationService.send('verify_email', user.email, {
                name: user.firstName,
                verify_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email?token=${verifyToken}`
            }, user.id, null, t);
        }
    } catch (e) {}

    try {
      if (AuditService && AuditService.log) {
        await AuditService.log({
          userId: user.id,
          action: ACTIONS.VERIFICATION_RESENT,
          entity: ENTITIES.USER,
          entityId: user.id,
        });
      }
    } catch (e) {}
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

    try {
      if (AuditService && AuditService.log) {
        await AuditService.log({
          userId: user.id,
          action: ACTIONS.EMAIL_VERIFIED,
          entity: ENTITIES.USER,
          entityId: user.id,
        });
      }
    } catch (e) {}
  });
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification
};
