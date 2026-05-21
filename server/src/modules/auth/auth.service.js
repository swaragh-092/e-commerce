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

const JWT_ALGORITHMS = { algorithms: ['HS256'] };

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

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
    const { getResolvedFeature } = require('../../middleware/featureGate.middleware');
    return await getResolvedFeature('emailVerification');
  } catch {
    return false;
  }
};

const JWT_ISS = process.env.JWT_ISSUER || 'ecommerce-pro';
const JWT_AUD = process.env.JWT_AUDIENCE || 'ecommerce-pro-client';

const generateTokens = (user) => {
  const payload = { id: user.id, role: user.role };
  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m', issuer: JWT_ISS, audience: JWT_AUD });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d', issuer: JWT_ISS, audience: JWT_AUD });
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
      token: hashToken(verifyToken),
      expiresAt: new Date(Date.now() + AUTH_TIME.EMAIL_VERIFICATION_TTL_MS)
    }, { transaction: t });

    // Generate JWTs
    const tokens = generateTokens(user);

    // Save refresh token (hashed)
    await RefreshToken.create({
      userId: user.id,
      token: hashToken(tokens.refreshToken),
      expiresAt: getRefreshTokenExpiryDate(),
      createdByIp: 'registration'
    }, { transaction: t });

    // Audit log inside transaction
    try {
      if (AuditService && AuditService.log) {
        await AuditService.log({
          userId: user.id,
          action: ACTIONS.CREATE,
          entity: ENTITIES.USER,
          entityId: user.id,
        }, t);
      }
    } catch (e) {
      logger.error('Registration audit log failed', { userId: user.id, error: e.message });
    }

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
      await NotificationService.send('email_verification', registrationResult.verificationEmail.email, {
        name: registrationResult.verificationEmail.firstName,
        verify_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email?token=${registrationResult.verificationEmail.verifyToken}`
      }, registrationResult.verificationEmail.userId);
    }
  } catch (e) {
    logger.error('Registration verification email failed', {
      userId: registrationResult.verificationEmail.userId,
      operation: 'NotificationService.send.email_verification',
      errorMessage: e.message,
      stack: e.stack,
    });
  }

  return registrationResult;
};

const bcrypt = require('bcryptjs');

// Pre-computed dummy hash for constant-time comparison when user doesn't exist
const DUMMY_HASH = '$2a$12$LJ3m4sMKfRzb3Z5K5K5K5OdummyhashfortimingatttackpreventionXX';

const login = async (email, password, ipAddress, rememberMe = false) => {
  const user = await User.scope('withPassword').findOne({
    where: { email },
    include: authUserInclude,
  });

  // Always run bcrypt.compare to prevent timing side-channel
  const isValid = user
    ? await user.validatePassword(password)
    : await bcrypt.compare(password, DUMMY_HASH);

  if (!user || !isValid) {
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

  // If 2FA is enabled, return a short-lived temp token instead of full auth
  if (user.twoFactorEnabled) {
    const tempToken = jwt.sign(
      { id: user.id, purpose: '2fa' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '5m' }
    );
    return { requiresTwoFactor: true, tempToken };
  }

  // Generate tokens
  const tokens = generateTokens(user);
  const ttl = rememberMe ? AUTH_TIME.REMEMBER_ME_TTL_MS : AUTH_TIME.REFRESH_TOKEN_TTL_MS;

  // Save refresh token (hashed)
  await RefreshToken.create({
    userId: user.id,
    token: hashToken(tokens.refreshToken),
    expiresAt: new Date(Date.now() + ttl),
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
    const decoded = jwt.verify(refreshTokenStr, process.env.JWT_REFRESH_SECRET, { algorithms: ['HS256'], issuer: JWT_ISS, audience: JWT_AUD });
    const emailVerificationRequired = await isEmailVerificationRequired();
    const tokenHash = hashToken(refreshTokenStr);

    return sequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
      async (t) => {
        const tokenRecord = await RefreshToken.findOne({
          where: { token: tokenHash },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!tokenRecord) {
          throw new AppError('UNAUTHORIZED', 401, 'Token not found');
        }
        if (tokenRecord.expiresAt < new Date()) {
          throw new AppError('UNAUTHORIZED', 401, 'Token expired');
        }

        // Reuse detection — a revoked token being replayed signals theft.
        if (tokenRecord.revokedAt) {
          await RefreshToken.update(
            { revokedAt: new Date() },
            { where: { userId: tokenRecord.userId, revokedAt: null }, transaction: t }
          );
          logger.warn('Refresh token reuse detected — all sessions revoked', {
            userId: tokenRecord.userId,
            replayedTokenId: tokenRecord.id,
            ipAddress,
          });
          throw new AppError('UNAUTHORIZED', 401, 'Token reuse detected. All sessions revoked.');
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
          token: hashToken(tokens.refreshToken),
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
            }, t);
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
  const tokenRecord = await RefreshToken.findOne({ where: { token: hashToken(refreshTokenStr) } });
  if (tokenRecord) {
    if (!userId || tokenRecord.userId !== userId) {
      throw new AppError('FORBIDDEN', 403, 'You do not have permission to revoke this token');
    }

    // Revoke ALL active refresh tokens for this user (full session termination)
    await RefreshToken.update(
      { revokedAt: new Date() },
      { where: { userId, revokedAt: null } }
    );
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
      token: hashToken(resetToken),
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
    const resetRecord = await PasswordResetToken.findOne({ where: { token: hashToken(token) }, transaction: t });
    
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
        }, t);
      }
    } catch (e) {}
  });
};

const resendVerification = async (email) => {
  return sequelize.transaction(async (t) => {
    const user = await User.findOne({ where: { email }, transaction: t });
    if (!user || user.emailVerified) return; // Silent return — no state leak

    await EmailVerificationToken.destroy({ where: { userId: user.id }, transaction: t });

    const verifyToken = crypto.randomBytes(32).toString('hex');
    await EmailVerificationToken.create({
      userId: user.id,
      token: hashToken(verifyToken),
      expiresAt: new Date(Date.now() + AUTH_TIME.EMAIL_VERIFICATION_TTL_MS)
    }, { transaction: t });

    try {
        if (NotificationService && NotificationService.send) {
            await NotificationService.send('email_verification', user.email, {
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
        }, t);
      }
    } catch (e) {}
  });
};

const verifyEmail = async (token) => {
  return sequelize.transaction(async (t) => {
    const verifyRecord = await EmailVerificationToken.findOne({ where: { token: hashToken(token) }, transaction: t });
    
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
        }, t);
      }
    } catch (e) {}
  });
};

const verifyTwoFactor = async (tempToken, totpCode, ipAddress) => {
  let decoded;
  try {
    decoded = jwt.verify(tempToken, process.env.JWT_ACCESS_SECRET, JWT_ALGORITHMS);
  } catch (err) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid or expired 2FA token');
  }

  if (decoded.purpose !== '2fa') {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid token purpose');
  }

  const user = await User.scope('withPassword').findByPk(decoded.id, { include: authUserInclude });
  if (!user || user.status !== 'active') {
    throw new AppError('FORBIDDEN', 403, 'User inactive');
  }

  const TwoFactorService = require('./twoFactor.service');
  if (!TwoFactorService.verify(user, totpCode)) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid 2FA code');
  }

  const tokens = generateTokens(user);
  await RefreshToken.create({
    userId: user.id,
    token: hashToken(tokens.refreshToken),
    expiresAt: getRefreshTokenExpiryDate(),
    createdByIp: ipAddress,
  });

  await user.update({ lastLoginAt: new Date() });
  const userData = await User.findByPk(user.id, { include: authUserInclude });

  try {
    if (AuditService && AuditService.log) {
      await AuditService.log({ userId: user.id, action: ACTIONS.LOGIN, entity: ENTITIES.USER, entityId: user.id, ipAddress });
    }
  } catch (e) {}

  return { user: enrichUserAuthorization(userData), tokens };
};

const loginByPhone = async (phone, ipAddress) => {
  // Find user by phone in user_profiles
  const profile = await UserProfile.findOne({ where: { phone } });

  let user;
  if (profile) {
    user = await User.findByPk(profile.userId, { include: authUserInclude });
    if (!user || user.status !== 'active') {
      throw new AppError('FORBIDDEN', 403, 'Account is inactive');
    }
  } else {
    // Auto-create user for phone-based sign-in
    user = await sequelize.transaction(async (t) => {
      const newUser = await User.create({
        email: `${phone}@phone.local`, // placeholder — phone-only users
        password: require('crypto').randomBytes(32).toString('hex'),
        firstName: 'User',
        role: 'customer',
        status: 'active',
        emailVerified: false,
      }, { transaction: t });

      await UserProfile.create({ userId: newUser.id, phone }, { transaction: t });

      const customerRole = await Role.findOne({ where: { slug: 'customer' }, transaction: t });
      if (customerRole) await newUser.setRoles([customerRole], { transaction: t });

      return await User.findByPk(newUser.id, { include: authUserInclude, transaction: t });
    });
  }

  const tokens = generateTokens(user);
  await RefreshToken.create({
    userId: user.id,
    token: hashToken(tokens.refreshToken),
    expiresAt: getRefreshTokenExpiryDate(),
    createdByIp: ipAddress,
  });

  await user.update({ lastLoginAt: new Date() });
  const userData = await User.findByPk(user.id, { include: authUserInclude });

  try {
    if (AuditService && AuditService.log) {
      await AuditService.log({ userId: user.id, action: ACTIONS.LOGIN, entity: ENTITIES.USER, entityId: user.id, ipAddress });
    }
  } catch (e) {}

  return { user: enrichUserAuthorization(userData), tokens };
};

module.exports = {
  register,
  login,
  loginByPhone,
  verifyTwoFactor,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification
};
