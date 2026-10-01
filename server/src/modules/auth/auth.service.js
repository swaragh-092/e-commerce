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

const { hashToken, generateTokens, signTempTwoFactorToken } = require('./tokenUtils');

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

// Per-account login brute-force guard (in-memory; use Redis for
// multi-instance — same caveat as tokenBlocklist).
const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const loginFailures = new Map(); // normalizedEmail -> { count, firstAt, lockedUntil }

const checkLoginLock = (normalizedEmail) => {
  const rec = loginFailures.get(normalizedEmail);
  if (!rec) return;
  const now = Date.now();
  if (rec.lockedUntil && now < rec.lockedUntil) {
    throw new AppError('TOO_MANY_REQUESTS', 429, 'Too many failed attempts for this account. Please try again later.');
  }
  if (now - rec.firstAt > LOGIN_FAIL_WINDOW_MS) loginFailures.delete(normalizedEmail);
};

const recordLoginFailure = (normalizedEmail) => {
  const now = Date.now();
  const rec = loginFailures.get(normalizedEmail);
  if (!rec || now - rec.firstAt > LOGIN_FAIL_WINDOW_MS) {
    loginFailures.set(normalizedEmail, { count: 1, firstAt: now, lockedUntil: null });
    return;
  }
  rec.count += 1;
  if (rec.count >= LOGIN_MAX_FAILS) rec.lockedUntil = now + LOGIN_LOCK_MS;
};

// Quiet per-email throttle for password-reset / verification mail so rotating
// IPs can't inbox-spam a victim. Throttled requests return success silently
// (no oracle, no duplicate mail).
const EMAIL_SEND_QUIET_MS = 5 * 60 * 1000;
const lastEmailSentAt = new Map(); // `${kind}:${email}` -> timestamp
const isEmailThrottled = (kind, normalizedEmail) => {
  const last = lastEmailSentAt.get(`${kind}:${normalizedEmail}`);
  if (last && Date.now() - last < EMAIL_SEND_QUIET_MS) return true;
  lastEmailSentAt.set(`${kind}:${normalizedEmail}`, Date.now());
  return false;
};

// Bound the in-memory throttle maps — entries are short-lived, sweep them.
setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of loginFailures) {
    const lastActivity = Math.max(rec.firstAt || 0, rec.lockedUntil || 0);
    if (now - lastActivity > LOGIN_FAIL_WINDOW_MS + LOGIN_LOCK_MS) loginFailures.delete(key);
  }
  for (const [key, ts] of lastEmailSentAt) {
    if (now - ts > EMAIL_SEND_QUIET_MS * 2) lastEmailSentAt.delete(key);
  }
}, 5 * 60 * 1000).unref();

const getClientBaseUrl = () => {
  const url = process.env.CLIENT_URL || 'http://localhost:5173';
  return url.split(',')[0].trim().replace(/\/+$/, '');
};

const register = async (payload, ipAddress = null) => {
  const normalizedEmail = String(payload.email || '').trim().toLowerCase();
  // Resolve outside the transaction (feature flags use their own reads).
  const verificationRequired = await isEmailVerificationRequired();
  const registrationResult = await sequelize.transaction(async (t) => {
    // Check if email exists (case-insensitive — DB unique is case-sensitive,
    // so normalize + check LOWER() to prevent Test@x.com / test@x.com dupes)
    const existingUser = await User.findOne({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), normalizedEmail),
      transaction: t,
    });
    if (existingUser) {
      throw new AppError('VALIDATION_ERROR', 400, 'User with this email already exists');
    }

    // Create User & Profile
    let user;
    try {
      user = await User.create({
        firstName: String(payload.firstName || '').trim(),
        lastName: String(payload.lastName || '').trim(),
        email: normalizedEmail,
        password: payload.password, // model hook will hash this
        role: 'customer',
        status: 'active'
      }, { transaction: t });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        throw new AppError('VALIDATION_ERROR', 400, 'User with this email already exists');
      }
      throw err;
    }

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

    // Generate JWTs with session ID — but NOT when email verification is
    // mandatory: an unverified address must never yield an authenticated
    // session (login/refresh both enforce this; register must match).
    let tokens = null;
    if (!verificationRequired) {
      const sessionId = crypto.randomUUID();
      tokens = generateTokens(user, sessionId);

      // Save refresh token (hashed)
      await RefreshToken.create({
        id: sessionId,
        userId: user.id,
        token: hashToken(tokens.refreshToken),
        expiresAt: getRefreshTokenExpiryDate(),
        createdByIp: ipAddress || 'registration'
      }, { transaction: t });
    }

    // Audit log inside transaction
    try {
      if (AuditService && AuditService.log) {
        await AuditService.log({
          userId: user.id,
          action: ACTIONS.CREATE,
          entity: ENTITIES.USER,
          entityId: user.id,
          ipAddress,
        }, t);
      }
    } catch (e) {
      logger.error('Registration audit log failed', { userId: user.id, error: e.message });
    }

    return {
      user: enrichUserAuthorization(user),
      tokens,
      requiresVerification: verificationRequired,
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
        verify_url: `${getClientBaseUrl()}/verify-email?token=${registrationResult.verificationEmail.verifyToken}`
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

  try {
    if (NotificationService && NotificationService.send) {
      await NotificationService.send('welcome', registrationResult.verificationEmail.email, {
        name: registrationResult.verificationEmail.firstName,
      }, registrationResult.verificationEmail.userId);
    }
  } catch (e) {
    logger.error('Registration welcome email failed', {
      userId: registrationResult.verificationEmail.userId,
      operation: 'NotificationService.send.welcome',
      errorMessage: e.message,
      stack: e.stack,
    });
  }

  return registrationResult;
};

const bcrypt = require('bcryptjs');

// Pre-computed dummy hash for constant-time comparison when user doesn't exist
// Generated via: bcrypt.hashSync('dummy-password-never-matches', 12)
const DUMMY_HASH = '$2a$12$dpabKKLz0iNKPD1LEZL0oOGI86Zcks4c1j0jbtA3f1FwXE55zzNXa';

const { parseDeviceName } = require('../../utils/deviceParser');
const AccountEvents = require('./accountEvents');

const login = async (email, password, ipAddress, rememberMe = false, userAgent, trustedDevice) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  checkLoginLock(normalizedEmail);
  const user = await User.scope('withPassword').findOne({
    where: { email: normalizedEmail },
    include: authUserInclude,
  });

  // Always run bcrypt.compare to prevent timing side-channel
  const isValid = user
    ? await user.validatePassword(password)
    : await bcrypt.compare(password, DUMMY_HASH);

  if (!user || !isValid) {
    recordLoginFailure(normalizedEmail);
    throw new AppError('UNAUTHORIZED', 401, 'Invalid email or password');
  }
  loginFailures.delete(normalizedEmail);

  if (user.status !== 'active') {
    throw new AppError('FORBIDDEN', 403, 'Your account is inactive or banned');
  }

  if (user.scheduledDeletionAt && new Date(user.scheduledDeletionAt) <= new Date()) {
    throw new AppError('FORBIDDEN', 403, 'Account deletion period has expired');
  }

  if (await isEmailVerificationRequired()) {
    if (!user.emailVerified) {
      throw new AppError('FORBIDDEN', 403, 'Please verify your email before logging in');
    }
  }

  // If 2FA is enabled, check trusted device cookie before requiring TOTP.
  // The cookie is a signed JWT (see authCookies.signTrustedDevice) — never a
  // deterministic hash, so it cannot be forged without the JWT secret.
  if (user.twoFactorEnabled) {
    const { verifyTrustedDevice } = require('./authCookies');
    if (trustedDevice && verifyTrustedDevice(trustedDevice, user.id)) {
      // Trusted device — skip 2FA
    } else {
      return { requiresTwoFactor: true, tempToken: signTempTwoFactorToken(user.id) };
    }
  }

  // Generate tokens with session ID
  const sessionId = crypto.randomUUID();
  const tokens = generateTokens(user, sessionId);
  const ttl = rememberMe ? AUTH_TIME.REMEMBER_ME_TTL_MS : AUTH_TIME.REFRESH_TOKEN_TTL_MS;

  // New device/IP detection (before creating new token)
  let isNewDevice = false;
  try {
    const deviceName = parseDeviceName(userAgent);
    const knownSession = await RefreshToken.findOne({
      where: { userId: user.id, deviceName, createdByIp: ipAddress, revokedAt: null },
      attributes: ['id'],
    });
    isNewDevice = !knownSession;
  } catch (e) {}

  // Save refresh token (hashed)
  await RefreshToken.create({
    id: sessionId,
    userId: user.id,
    token: hashToken(tokens.refreshToken),
    expiresAt: new Date(Date.now() + ttl),
    createdByIp: ipAddress,
    userAgent: userAgent || null,
    deviceName: parseDeviceName(userAgent),
    lastActiveAt: new Date(),
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

  // New device/IP notification
  if (isNewDevice) {
    try {
      if (NotificationService && NotificationService.send) {
        await NotificationService.send('new_login_alert', user.email, {
          name: user.firstName,
          device: parseDeviceName(userAgent),
          ip: ipAddress,
          time: new Date().toLocaleString(),
        }, user.id);
      }
    } catch (e) {}
  }

  // Emit account event
  AccountEvents.emit('login', { userId: user.id, ipAddress, device: parseDeviceName(userAgent) });

  return { user: enrichUserAuthorization(userData), tokens };
};

const refresh = async (refreshTokenStr, ipAddress, userAgent) => {
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
        if (user.scheduledDeletionAt && new Date(user.scheduledDeletionAt) <= new Date()) {
          throw new AppError('FORBIDDEN', 403, 'Account deletion period has expired');
        }

        if (emailVerificationRequired) {
          if (!user.emailVerified) {
            throw new AppError('FORBIDDEN', 403, 'Please verify your email before logging in');
          }
        }

        const sessionId = crypto.randomUUID();
        const tokens = generateTokens(user, sessionId);

        // Preserve the original session duration (remember-me 30d vs default 7d)
        // so a remember-me session doesn't shrink to 7d after the first rotation.
        let rememberMe = false;
        try {
          const createdAt = new Date(tokenRecord.createdAt).getTime();
          const expiresAt = new Date(tokenRecord.expiresAt).getTime();
          const originalTtl = expiresAt - createdAt;
          rememberMe = originalTtl > 8 * 24 * 60 * 60 * 1000;
        } catch { rememberMe = false; }
        const newExpiry = new Date(Date.now() + (rememberMe ? AUTH_TIME.REMEMBER_ME_TTL_MS : AUTH_TIME.REFRESH_TOKEN_TTL_MS));

        await tokenRecord.update({ revokedAt: new Date() }, { transaction: t });
        await RefreshToken.create({
          id: sessionId,
          userId: user.id,
          token: hashToken(tokens.refreshToken),
          expiresAt: newExpiry,
          createdByIp: ipAddress,
          userAgent: userAgent || tokenRecord.userAgent,
          deviceName: userAgent ? parseDeviceName(userAgent) : tokenRecord.deviceName,
          lastActiveAt: new Date(),
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

        return { tokens, rememberMe };
      }
    );
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('UNAUTHORIZED', 401, 'Invalid or expired refresh token');
  }
};

const logout = async (refreshTokenStr, userId) => {
  const tokenRecord = refreshTokenStr
    ? await RefreshToken.findOne({ where: { token: hashToken(refreshTokenStr) } })
    : null;
  // Resolve userId from the refresh JWT when the caller has no access token
  // (e.g. access expired but refresh still valid). This allows refresh-only logout.
  let effectiveUserId = userId;
  if (!effectiveUserId && refreshTokenStr) {
    try {
      const decoded = jwt.verify(refreshTokenStr, process.env.JWT_REFRESH_SECRET, {
        algorithms: ['HS256'],
        issuer: JWT_ISS,
        audience: JWT_AUD,
      });
      effectiveUserId = decoded.id || null;
    } catch { /* expired/invalid — fall through to tokenRecord check */ }
  }
  if (tokenRecord) {
    const ownerId = tokenRecord.userId;
    if (!effectiveUserId || ownerId !== effectiveUserId) {
      throw new AppError('FORBIDDEN', 403, 'You do not have permission to revoke this token');
    }

    // Revoke ONLY the presented session. Use "revoke all others" or admin
    // force-logout for full termination — single logout must not kill mobile+desktop.
    await RefreshToken.update(
      { revokedAt: new Date() },
      { where: { id: tokenRecord.id, revokedAt: null } }
    );
    try {
      require('../../utils/tokenBlocklist').revokeSession(tokenRecord.id);
    } catch { /* kill-switch best-effort */ }
  }
  
  try {
      if (AuditService && AuditService.log) {
          await AuditService.log({
              userId: effectiveUserId || tokenRecord?.userId,
              action: ACTIONS.LOGOUT,
              entity: ENTITIES.USER,
              entityId: effectiveUserId || tokenRecord?.userId
          });
      }
  } catch(e) {}

  AccountEvents.emit('logout', { userId: effectiveUserId || tokenRecord?.userId });
};

const forgotPassword = async (email) => {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const user = await User.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('email')),
      normalizedEmail
    )
  });
  if (!user) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn(`[Auth] Forgot password requested for "${email}", but no user exists with this email in the database.`);
    }
    return; // Silent return for security (don't reveal if email exists)
  }

  // Quiet per-email throttle: rotating IPs must not inbox-spam one victim.
  if (isEmailThrottled('forgot', normalizedEmail)) return;

  await sequelize.transaction(async (t) => {
    // Delete any existing unused tokens for this user
    await PasswordResetToken.destroy({ where: { userId: user.id }, transaction: t });

    const resetToken = crypto.randomBytes(32).toString('hex');
    await PasswordResetToken.create({
      userId: user.id,
      token: hashToken(resetToken),
      expiresAt: new Date(Date.now() + AUTH_TIME.PASSWORD_RESET_TTL_MS)
    }, { transaction: t });

    const resetUrl = `${getClientBaseUrl()}/reset-password?token=${resetToken}`;
    if (process.env.NODE_ENV === 'development') {
      // Never log the raw token — dev logs persist in history/CI output.
      logger.info(`[Auth] Password reset link generated for ${user.email} (token redacted, 15m TTL)`);
    }

    try {
        if (NotificationService && NotificationService.send) {
            await NotificationService.send('password_reset', user.email, {
                name: user.firstName,
                reset_url: resetUrl
            }, user.id, null, 'email', t);
        }
    } catch (e) {
        logger.error('Password reset notification failed', {
            userId: user.id,
            error: e.message,
            stack: e.stack
        });
    }
  });

  // Promptly trigger queue processor so user does not have to wait for 1-minute cron
  if (NotificationService && typeof NotificationService.processQueued === 'function') {
    setImmediate(() => {
      NotificationService.processQueued({ limit: 10 }).catch((err) => {
        logger.error('[Auth] Failed to process notification queue immediately', err);
      });
    });
  }
};

const resetPassword = async (token, newPassword) => {
  return sequelize.transaction(async (t) => {
    const resetRecord = await PasswordResetToken.findOne({
      where: { token: hashToken(String(token || '').trim()) },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!resetRecord || resetRecord.expiresAt < new Date()) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid or expired reset token');
    }

    const user = await User.scope('withPassword').findByPk(resetRecord.userId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

    if (await user.validatePassword(newPassword)) {
      throw new AppError('VALIDATION_ERROR', 400, 'New password must be different from the current password');
    }

    await user.update({ password: newPassword }, { transaction: t });
    await resetRecord.destroy({ transaction: t }); // Delete token after use

    // Revoke (not hard-delete) all sessions so reuse detection/audit stay intact.
    const activeSessions = await RefreshToken.findAll({
      where: { userId: user.id, revokedAt: null },
      attributes: ['id'],
      transaction: t,
    });
    await RefreshToken.update(
      { revokedAt: new Date() },
      { where: { userId: user.id, revokedAt: null }, transaction: t }
    );
    try {
      const blocklist = require('../../utils/tokenBlocklist');
      activeSessions.forEach((s) => blocklist.revokeSession(s.id));
    } catch { /* kill-switch best-effort */ }

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
  const normalizedEmail = String(email || '').trim().toLowerCase();
  await sequelize.transaction(async (t) => {
    const user = await User.findOne({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), normalizedEmail),
      transaction: t,
    });
    if (!user || user.emailVerified) return; // Silent return — no state leak

    // Quiet per-email throttle (same anti-spam rationale as forgot-password).
    if (isEmailThrottled('resend', normalizedEmail)) return;

    await EmailVerificationToken.destroy({ where: { userId: user.id }, transaction: t });

    const verifyToken = crypto.randomBytes(32).toString('hex');
    await EmailVerificationToken.create({
      userId: user.id,
      token: hashToken(verifyToken),
      expiresAt: new Date(Date.now() + AUTH_TIME.EMAIL_VERIFICATION_TTL_MS)
    }, { transaction: t });

    const verifyUrl = `${getClientBaseUrl()}/verify-email?token=${verifyToken}`;
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[Auth] Email verification link generated for ${user.email} (token redacted, 24h TTL)`);
    }

    try {
        if (NotificationService && NotificationService.send) {
            await NotificationService.send('email_verification', user.email, {
                name: user.firstName,
                verify_url: verifyUrl
            }, user.id, null, 'email', t);
        }
    } catch (e) {
        logger.error('Resend verification notification failed', {
            userId: user.id,
            error: e.message,
            stack: e.stack
        });
    }

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

  if (NotificationService && typeof NotificationService.processQueued === 'function') {
    setImmediate(() => {
      NotificationService.processQueued({ limit: 10 }).catch((err) => {
        logger.error('[Auth] Failed to process notification queue immediately', err);
      });
    });
  }
};

const verifyEmail = async (token) => {
  return sequelize.transaction(async (t) => {
    const verifyRecord = await EmailVerificationToken.findOne({
      where: { token: hashToken(String(token || '').trim()) },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!verifyRecord || verifyRecord.expiresAt < new Date()) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid or expired verification token');
    }

    const user = await User.findByPk(verifyRecord.userId, { transaction: t, lock: t.LOCK.UPDATE });
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
    decoded = jwt.verify(tempToken, process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISS,
      audience: JWT_AUD,
    });
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
  if (user.scheduledDeletionAt && new Date(user.scheduledDeletionAt) <= new Date()) {
    throw new AppError('FORBIDDEN', 403, 'Account deletion period has expired');
  }

  const TwoFactorService = require('./twoFactor.service');
  let isValid = false;
  try {
    isValid = TwoFactorService.verify(user, totpCode);
  } catch (e) {}
  if (!isValid) {
    isValid = await TwoFactorService.verifyBackupCode(user, totpCode);
  }
  if (!isValid) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid 2FA code');
  }

  const sessionId = crypto.randomUUID();
  const tokens = generateTokens(user, sessionId);
  await RefreshToken.create({
    id: sessionId,
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
  const normalizedPhone = String(phone || '').trim();
  // Find user by phone in user_profiles (lookup inside tx below to close
  // the concurrent-first-login double-create race).
  let user = await sequelize.transaction(async (t) => {
    const profile = await UserProfile.findOne({
      where: { phone: normalizedPhone },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (profile) {
      const found = await User.findByPk(profile.userId, { include: authUserInclude, transaction: t });
      if (!found || found.status !== 'active') {
        throw new AppError('FORBIDDEN', 403, 'Account is inactive');
      }
      if (found.scheduledDeletionAt && new Date(found.scheduledDeletionAt) <= new Date()) {
        throw new AppError('FORBIDDEN', 403, 'Account deletion period has expired');
      }
      return found;
    }

    // Auto-create user for phone-based sign-in
    let newUser;
    try {
      newUser = await User.create({
        email: `${normalizedPhone}@phone.local`,
        password: require('crypto').randomBytes(32).toString('hex'),
        firstName: 'Phone User',
        lastName: '',
        role: 'customer',
        status: 'active',
        emailVerified: false,
      }, { transaction: t });

      await UserProfile.create({ userId: newUser.id, phone: normalizedPhone }, { transaction: t });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        throw new AppError('CONFLICT', 409, 'This phone number is already registered. Please try again.');
      }
      throw err;
    }

    const customerRole = await Role.findOne({ where: { slug: 'customer' }, transaction: t });
    if (customerRole) await newUser.setRoles([customerRole], { transaction: t });

    return await User.findByPk(newUser.id, { include: authUserInclude, transaction: t });
  });

  // If 2FA is enabled, return temp token instead of full auth
  if (user.twoFactorEnabled) {
    return { requiresTwoFactor: true, tempToken: signTempTwoFactorToken(user.id) };
  }

  return await sequelize.transaction(async (t) => {
    const sessionId = crypto.randomUUID();
    const tokens = generateTokens(user, sessionId);
    await RefreshToken.create({
      id: sessionId,
      userId: user.id,
      token: hashToken(tokens.refreshToken),
      expiresAt: getRefreshTokenExpiryDate(),
      createdByIp: ipAddress,
    }, { transaction: t });

    await user.update({ lastLoginAt: new Date() }, { transaction: t });
    const userData = await User.findByPk(user.id, { include: authUserInclude, transaction: t });

    try {
      if (AuditService && AuditService.log) {
        await AuditService.log({ userId: user.id, action: ACTIONS.LOGIN, entity: ENTITIES.USER, entityId: user.id, ipAddress }, t);
      }
    } catch (e) {}

    return { user: enrichUserAuthorization(userData), tokens };
  });
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
  resendVerification,
  hashToken,
  generateTokens,
};
