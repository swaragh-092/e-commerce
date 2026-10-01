'use strict';

const { sequelize, User, UserProfile, Order, Address, Media, Role, Permission } = require('../index');
const { Op } = require('sequelize');
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');
const { getPagination } = require('../../utils/pagination');
const { ACTIONS, ENTITIES } = require('../../config/constants');
const logger = require('../../utils/logger');

const getClientBaseUrl = () => {
  const url = process.env.CLIENT_URL || 'http://localhost:5173';
  return url.split(',')[0].trim().replace(/\/+$/, '');
};

const authzInclude = [
  {
    model: Role,
    as: 'roles',
    through: { attributes: [] },
    include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
  },
];

const getMe = async (userId) => {
  const user = await User.findByPk(userId, {
    include: [
      { model: UserProfile, as: 'profile' },
      ...authzInclude,
      // addresses can be included in Phase 4 when address module is fully integrated
    ]
  });

  if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
  return user;
};

const updateMe = async (userId, payload) => {
  return sequelize.transaction(async (t) => {
    const user = await User.findByPk(userId, { transaction: t });
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

    const before = user.toJSON();

    if (payload.firstName !== undefined || payload.lastName !== undefined) {
      // Validate only the fields being set (phone-created accounts start with
      // an empty lastName, so a combined non-empty requirement would block
      // them from ever setting just a firstName).
      if (payload.firstName !== undefined && !String(payload.firstName).trim()) {
        throw new AppError('VALIDATION_ERROR', 400, 'First name cannot be empty');
      }
      if (payload.lastName !== undefined && !String(payload.lastName).trim()) {
        throw new AppError('VALIDATION_ERROR', 400, 'Last name cannot be empty');
      }
      const nextFirst = payload.firstName !== undefined ? String(payload.firstName).trim() : user.firstName;
      const nextLast = payload.lastName !== undefined ? String(payload.lastName).trim() : user.lastName;
      await user.update({ firstName: nextFirst, lastName: nextLast }, { transaction: t });
    }

    if (payload.phone !== undefined || payload.gender !== undefined || payload.dateOfBirth !== undefined) {
      if (payload.phone !== undefined && payload.phone !== null && payload.phone !== '') {
        const existingPhone = await UserProfile.findOne({
          where: { phone: payload.phone },
          transaction: t,
        });
        if (existingPhone && existingPhone.userId !== userId) {
          throw new AppError('CONFLICT', 409, 'This phone number is already registered to another account');
        }
      }

      let profile = await UserProfile.findOne({ where: { userId }, transaction: t });
      if (!profile) {
        profile = await UserProfile.create({ userId }, { transaction: t });
      }
      try {
        await profile.update({
          phone: payload.phone !== undefined ? (payload.phone === '' ? null : payload.phone) : profile.phone,
          gender: payload.gender !== undefined ? payload.gender : profile.gender,
          dateOfBirth: payload.dateOfBirth !== undefined ? payload.dateOfBirth : profile.dateOfBirth,
        }, { transaction: t });
      } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
          throw new AppError('CONFLICT', 409, 'This phone number is already registered to another account');
        }
        throw err;
      }
    }
    
    // fetch updated record
    const updatedUser = await getMe(userId);

    try {
      if (AuditService && AuditService.log) {
        await AuditService.log({
          userId,
          action: ACTIONS.UPDATE,
          entity: ENTITIES.USER,
          entityId: userId,
          changes: { before, after: updatedUser.toJSON() }
        }, t);
      }
    } catch(err) {
      logger.error('AuditService.log failed for user profile update', {
        userId,
        entity: ENTITIES.USER,
        action: ACTIONS.UPDATE,
        operation: 'AuditService.log.updateMe',
        errorMessage: err.message,
        stack: err.stack,
      });
    }

    return updatedUser;
  });
};

const changePassword = async (userId, currentPassword, newPassword, keepSessionId = null) => {
  const { RefreshToken } = require('../index');
  return sequelize.transaction(async (t) => {
    const user = await User.scope('withPassword').findByPk(userId, { transaction: t });
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

    if (!(await user.validatePassword(currentPassword))) {
      throw new AppError('VALIDATION_ERROR', 400, 'Incorrect current password');
    }

    if (await user.validatePassword(newPassword)) {
      throw new AppError('VALIDATION_ERROR', 400, 'New password must be different from current password');
    }

    await user.update({ password: newPassword }, { transaction: t });

    // Revoke all other sessions — a password change must kill stolen sessions.
    if (keepSessionId) {
      const others = await RefreshToken.findAll({
        where: { userId, revokedAt: null, id: { [Op.ne]: keepSessionId } },
        attributes: ['id'],
        transaction: t,
      });
      await RefreshToken.update(
        { revokedAt: new Date() },
        { where: { userId, revokedAt: null, id: { [Op.ne]: keepSessionId } }, transaction: t }
      );
      try {
        const blocklist = require('../../utils/tokenBlocklist');
        others.forEach((s) => blocklist.revokeSession(s.id));
      } catch { /* kill-switch best-effort */ }
    } else {
      const others = await RefreshToken.findAll({
        where: { userId, revokedAt: null },
        attributes: ['id'],
        transaction: t,
      });
      await RefreshToken.update(
        { revokedAt: new Date() },
        { where: { userId, revokedAt: null }, transaction: t }
      );
      try {
        const blocklist = require('../../utils/tokenBlocklist');
        others.forEach((s) => blocklist.revokeSession(s.id));
      } catch { /* kill-switch best-effort */ }
    }

    try {
      if (AuditService && AuditService.log) {
        await AuditService.log({
          userId,
          action: ACTIONS.UPDATE,
          entity: ENTITIES.USER,
          entityId: userId,
          changes: { passwordChanged: true }
        }, t);
      }
    } catch (err) {
      logger.error('AuditService.log failed for password change', {
        userId,
        entity: ENTITIES.USER,
        action: ACTIONS.UPDATE,
        operation: 'AuditService.log.changePassword',
        errorMessage: err.message,
        stack: err.stack,
      });
    }
  });
};

const updateAvatar = async (userId, mediaId) => {
  return sequelize.transaction(async (t) => {
    const media = await Media.findByPk(mediaId, { transaction: t });
    if (!media) throw new AppError('NOT_FOUND', 404, 'Media not found');
    if (media.mimeType && !String(media.mimeType).startsWith('image/')) {
      throw new AppError('VALIDATION_ERROR', 400, 'Avatar must be an image file');
    }

    let profile = await UserProfile.findOne({ where: { userId }, transaction: t });
    if (!profile) {
      profile = await UserProfile.create({ userId, avatar: media.url }, { transaction: t });
    } else {
      await profile.update({ avatar: media.url }, { transaction: t });
    }

    // fetch updated record
    const updatedUser = await getMe(userId);

    try {
      if (AuditService && AuditService.log) {
        await AuditService.log({
          userId,
          action: ACTIONS.UPDATE,
          entity: ENTITIES.USER,
          entityId: userId,
          changes: { avatar: media.url }
        }, t);
      }
    } catch(err) {
      logger.error('AuditService.log failed for avatar update', {
        userId,
        entity: ENTITIES.USER,
        action: ACTIONS.UPDATE,
        operation: 'AuditService.log.updateAvatar',
        errorMessage: err.message,
        stack: err.stack,
      });
    }

    return updatedUser;
  });
};

const listAll = async ({ page, limit, status, role, search }) => {
  const { limit: lmt, offset } = getPagination(page, limit);
  const where = {};
  const andClauses = [];

  if (status) andClauses.push({ status });
  if (role) {
    if (role === 'customer') {
      andClauses.push(
        sequelize.literal(`NOT EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = "User"."id"
            AND r.slug != 'customer'
        )`),
        {
          [Op.or]: [
            { role: 'customer' },
            sequelize.literal(`EXISTS (
              SELECT 1 FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = "User"."id"
                AND (r.slug = 'customer' OR r.name ILIKE 'customer')
            )`),
          ],
        }
      );
    } else {
      andClauses.push({
        [Op.or]: [
          sequelize.literal(`EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = "User"."id"
              AND (r.slug = ${sequelize.escape(role)} OR r.name ILIKE ${sequelize.escape(role)})
          )`),
          {
            [Op.and]: [
              { role },
              sequelize.literal(`NOT EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = "User"."id"
                  AND r.slug != ${sequelize.escape(role)}
              )`),
            ],
          },
        ],
      });
    }
  }
  if (search && search.trim()) {
    const pattern = `%${search.trim()}%`;
    andClauses.push({
      [Op.or]: [
        { firstName: { [Op.iLike]: pattern } },
        { lastName: { [Op.iLike]: pattern } },
        { email: { [Op.iLike]: pattern } },
        sequelize.where(
          sequelize.fn('concat', sequelize.col('first_name'), ' ', sequelize.col('last_name')),
          { [Op.iLike]: pattern }
        ),
      ],
    });
  }

  if (andClauses.length > 0) {
    where[Op.and] = andClauses;
  }

  return User.findAndCountAll({
    where,
    distinct: true,
    limit: lmt,
    offset,
    order: [['createdAt', 'DESC']],
    attributes: { exclude: ['password', 'twoFactorSecret', 'twoFactorBackupCodes'] },
    include: authzInclude,
  });
};

const getById = async (id) => {
  const user = await User.findByPk(id, {
    include: [
      { model: UserProfile, as: 'profile' },
      ...authzInclude,
      { model: Address, separate: true, order: [['isDefault', 'DESC'], ['createdAt', 'DESC']] },
      {
        model: Order,
        separate: true,
        limit: 10,
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'orderNumber', 'status', 'orderShippingStatus', 'total', 'paymentMethod', 'createdAt', 'updatedAt'],
      },
    ],
    attributes: { exclude: ['password', 'twoFactorSecret', 'twoFactorBackupCodes'] }
  });

  if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
  return user;
};

const updateStatus = async (id, status, actingUserId) => {
  const { RefreshToken } = require('../index');
  return sequelize.transaction(async (t) => {
    const user = await User.findByPk(id, { include: authzInclude, transaction: t });
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
    
    if (user.id === actingUserId) {
        throw new AppError('VALIDATION_ERROR', 400, 'You cannot change your own status');
    }

    // Last-admin guard must consider BOTH the legacy `role` column and
    // join-table assignments — a super_admin via roles join with legacy
    // `admin` would otherwise bypass the check.
    const assignedSlugs = Array.isArray(user.roles)
      ? user.roles.map((r) => (typeof r === 'string' ? r : r?.slug || r?.name)).filter(Boolean)
      : [];
    const isSuperAdmin = user.role === 'super_admin' || assignedSlugs.includes('super_admin');
    if (isSuperAdmin && status !== 'active') {
      const rows = await sequelize.query(
        `SELECT COUNT(DISTINCT u.id) AS "count" FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE u.status = 'active' AND u.deleted_at IS NULL
           AND (u.role = 'super_admin' OR r.slug = 'super_admin')`,
        { transaction: t, type: sequelize.QueryTypes.SELECT }
      );
      const activeSuperAdminCount = Number(rows?.[0]?.count || 0);
      if (activeSuperAdminCount <= 1) {
        throw new AppError('VALIDATION_ERROR', 400, 'Cannot deactivate or ban the last active super admin');
      }
    }

    const before = user.toJSON();
    await user.update({ status }, { transaction: t });

    // Revoke refresh tokens on deactivation or ban so sessions cannot be resurrected
    if (status !== 'active') {
      const active = await RefreshToken.findAll({
        where: { userId: id, revokedAt: null },
        attributes: ['id'],
        transaction: t,
      });
      await RefreshToken.update(
        { revokedAt: new Date() },
        { where: { userId: id, revokedAt: null }, transaction: t }
      );
      try {
        const blocklist = require('../../utils/tokenBlocklist');
        active.forEach((s) => blocklist.revokeSession(s.id));
      } catch { /* kill-switch best-effort */ }
    }

    try {
      if (AuditService && AuditService.log) {
        await AuditService.log({
          userId: actingUserId,
          action: ACTIONS.STATUS_CHANGE,
          entity: ENTITIES.USER,
          entityId: id,
          changes: { before: before.status, after: status }
        }, t);
      }
    } catch(err) {
      logger.error('AuditService.log failed for user status update', {
        userId: actingUserId,
        entity: ENTITIES.USER,
        action: ACTIONS.STATUS_CHANGE,
        operation: 'AuditService.log.updateStatus',
        errorMessage: err.message,
        stack: err.stack,
      });
    }

    return user;
  });
};

const getAddresses = async (userId) => {
  return Address.findAll({
    where: { userId },
    order: [['isDefault', 'DESC'], ['createdAt', 'DESC']]
  });
};

const MAX_ADDRESSES_PER_USER = 10;

const createAddress = async (userId, payload) => {
  return sequelize.transaction(async (t) => {
    const addressCount = await Address.count({ where: { userId }, transaction: t });
    if (addressCount >= MAX_ADDRESSES_PER_USER) {
      throw new AppError('VALIDATION_ERROR', 400, `You can save up to ${MAX_ADDRESSES_PER_USER} addresses. Delete one to add another.`);
    }
    if (payload.isDefault) {
      await Address.update({ isDefault: false }, { where: { userId }, transaction: t });
    } else {
      if (addressCount === 0) {
        payload.isDefault = true;
      }
    }
    
    const address = await Address.create({ ...payload, userId }, { transaction: t });

    try {
      if (AuditService && AuditService.log) {
        await AuditService.log({
          userId,
          action: ACTIONS.CREATE,
          entity: ENTITIES.ADDRESS,
          entityId: address.id,
          changes: { address: address.toJSON() }
        }, t);
      }
    } catch (err) {
      logger.error('AuditService.log failed for address create', {
        userId,
        entity: ENTITIES.ADDRESS,
        action: ACTIONS.CREATE,
        operation: 'AuditService.log.createAddress',
        errorMessage: err.message,
        stack: err.stack,
      });
    }

    return address;
  });
};

const updateAddress = async (userId, addressId, payload) => {
  return sequelize.transaction(async (t) => {
    const address = await Address.findOne({ where: { id: addressId, userId }, transaction: t });
    if (!address) throw new AppError('NOT_FOUND', 404, 'Address not found');

    const before = address.toJSON();

    // Prevent ending up with zero defaults via direct unset — set another
    // address as default instead.
    if (payload.isDefault === false && address.isDefault) {
      throw new AppError('VALIDATION_ERROR', 400, 'Cannot unset the default address. Set another address as default instead.');
    }

    if (payload.isDefault && !address.isDefault) {
      await Address.update({ isDefault: false }, { where: { userId }, transaction: t });
    }

    await address.update(payload, { transaction: t });

    try {
      if (AuditService && AuditService.log) {
        await AuditService.log({
          userId,
          action: ACTIONS.UPDATE,
          entity: ENTITIES.ADDRESS,
          entityId: address.id,
          changes: { before, after: address.toJSON() }
        }, t);
      }
    } catch (err) {
      logger.error('AuditService.log failed for address update', {
        userId,
        entity: ENTITIES.ADDRESS,
        action: ACTIONS.UPDATE,
        operation: 'AuditService.log.updateAddress',
        errorMessage: err.message,
        stack: err.stack,
      });
    }

    return address;
  });
};

const deleteAddress = async (userId, addressId) => {
  return sequelize.transaction(async (t) => {
    const address = await Address.findOne({ where: { id: addressId, userId }, transaction: t });
    if (!address) throw new AppError('NOT_FOUND', 404, 'Address not found');

    const before = address.toJSON();

    await address.destroy({ transaction: t });
    
    if (address.isDefault) {
      const nextAddress = await Address.findOne({
         where: { userId },
         order: [['createdAt', 'DESC']],
         transaction: t 
      });
      if (nextAddress) {
        await nextAddress.update({ isDefault: true }, { transaction: t });
      }
    }

    try {
      if (AuditService && AuditService.log) {
        await AuditService.log({
          userId,
          action: ACTIONS.DELETE,
          entity: ENTITIES.ADDRESS,
          entityId: addressId,
          changes: { before }
        }, t);
      }
    } catch (err) {
      logger.error('AuditService.log failed for address delete', {
        userId,
        entity: ENTITIES.ADDRESS,
        action: ACTIONS.DELETE,
        operation: 'AuditService.log.deleteAddress',
        errorMessage: err.message,
        stack: err.stack,
      });
    }
  });
};

const setDefaultAddress = async (userId, addressId) => {
  return sequelize.transaction(async (t) => {
    const address = await Address.findOne({ where: { id: addressId, userId }, transaction: t });
    if (!address) throw new AppError('NOT_FOUND', 404, 'Address not found');

    const before = address.toJSON();

    if (!address.isDefault) {
      await Address.update({ isDefault: false }, { where: { userId }, transaction: t });
      await address.update({ isDefault: true }, { transaction: t });
    }

    try {
      if (before.isDefault !== address.isDefault && AuditService && AuditService.log) {
        await AuditService.log({
          userId,
          action: ACTIONS.STATUS_CHANGE,
          entity: ENTITIES.ADDRESS,
          entityId: address.id,
          changes: { before: before.isDefault, after: address.isDefault }
        }, t);
      }
    } catch (err) {
      logger.error('AuditService.log failed for default address update', {
        userId,
        entity: ENTITIES.ADDRESS,
        action: ACTIONS.STATUS_CHANGE,
        operation: 'AuditService.log.setDefaultAddress',
        errorMessage: err.message,
        stack: err.stack,
      });
    }

    return address;
  });
};

const ACTIVE_ORDER_STATUSES = ['pending_payment', 'confirmed', 'on_hold', 'processing', 'ready_for_shipment'];
const DELETION_GRACE_DAYS = 30;

const deleteAccount = async (userId, { password } = {}) => {
  const { RefreshToken } = require('../index');
  const NotificationService = require('../notification/notification.service');

  return sequelize.transaction(async (t) => {
    const user = await User.scope('withPassword').findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

    // Verify identity with password. The previous `oauthProvider: 'google'` flag
    // accepted without proof is removed — any caller could bypass the check.
    // OAuth users without a known password must set one via forgot-password first.
    if (!password) throw new AppError('VALIDATION_ERROR', 400, 'Password is required');
    if (!(await user.validatePassword(password))) {
      throw new AppError('VALIDATION_ERROR', 400, 'Incorrect password');
    }

    if (user.scheduledDeletionAt) {
      throw new AppError('VALIDATION_ERROR', 400, 'Account deletion is already scheduled');
    }

    // Block if active orders exist
    const activeOrders = await Order.count({
      where: { userId, status: { [Op.in]: ACTIVE_ORDER_STATUSES } },
      transaction: t,
    });
    if (activeOrders > 0) {
      throw new AppError('VALIDATION_ERROR', 400, `Cannot delete account with ${activeOrders} active order(s). Please complete or cancel them first.`);
    }

    // Schedule deletion (30-day grace period)
    const scheduledDeletionAt = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
    await user.update({ scheduledDeletionAt }, { transaction: t });

    // Revoke all sessions immediately — a scheduled-deletion account must not stay usable.
    const activeSessions = await RefreshToken.findAll({
      where: { userId, revokedAt: null },
      attributes: ['id'],
      transaction: t,
    });
    await RefreshToken.update(
      { revokedAt: new Date() },
      { where: { userId, revokedAt: null }, transaction: t }
    );
    try {
      const blocklist = require('../../utils/tokenBlocklist');
      activeSessions.forEach((s) => blocklist.revokeSession(s.id));
    } catch { /* kill-switch best-effort */ }

    try {
      if (AuditService && AuditService.log) {
        await AuditService.log({ userId, action: ACTIONS.DELETE, entity: ENTITIES.USER, entityId: userId }, t);
      }
    } catch (e) {}

    // Send confirmation email
    try {
      if (NotificationService && NotificationService.send) {
        await NotificationService.send('account_deletion_scheduled', user.email, {
          name: user.firstName,
          deletion_date: scheduledDeletionAt.toLocaleDateString(),
          cancel_url: `${getClientBaseUrl()}/account?cancelDeletion=true`,
        }, userId, null, 'email', t);
      }
    } catch (e) {}

    return { scheduledDeletionAt };
  });
};

const cancelAccountDeletion = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
  if (!user.scheduledDeletionAt) throw new AppError('VALIDATION_ERROR', 400, 'No pending deletion to cancel');

  await user.update({ scheduledDeletionAt: null });
  return { cancelled: true };
};

const getSessions = async (userId, currentAccessToken) => {
  const { RefreshToken } = require('../index');
  const jwt = require('jsonwebtoken');

  const sessions = await RefreshToken.findAll({
    where: { userId, revokedAt: null },
    attributes: ['id', 'createdByIp', 'deviceName', 'lastActiveAt', 'createdAt'],
    order: [['lastActiveAt', 'DESC']],
  });

  let currentSessionId = null;
  if (currentAccessToken) {
    try {
      let decoded;
      try {
        decoded = jwt.verify(currentAccessToken, process.env.JWT_ACCESS_SECRET, {
          algorithms: ['HS256'],
          issuer: process.env.JWT_ISSUER || 'ecommerce-pro',
          audience: process.env.JWT_AUDIENCE || 'ecommerce-pro-client',
        });
      } catch {
        decoded = jwt.verify(currentAccessToken, process.env.JWT_ACCESS_SECRET, {
          algorithms: ['HS256'],
        });
      }
      if (!decoded.purpose) currentSessionId = decoded.sid || null;
    } catch (e) {}
  }

  return sessions.map((s) => ({
    id: s.id,
    deviceName: s.deviceName || 'Unknown device',
    ipAddress: s.createdByIp,
    lastActiveAt: s.lastActiveAt || s.createdAt,
    createdAt: s.createdAt,
    // Honest when the current session can't be determined (never guess idx 0).
    isCurrent: currentSessionId ? s.id === currentSessionId : false,
  }));
};

const revokeSession = async (userId, sessionId) => {
  const { RefreshToken } = require('../index');
  const session = await RefreshToken.findOne({ where: { id: sessionId, userId, revokedAt: null } });
  if (!session) throw new AppError('NOT_FOUND', 404, 'Session not found');
  await session.update({ revokedAt: new Date() });
  try {
    require('../../utils/tokenBlocklist').revokeSession(sessionId);
  } catch { /* kill-switch best-effort */ }
};

const revokeAllOtherSessions = async (userId, currentAccessToken) => {
  const { RefreshToken } = require('../index');
  const jwt = require('jsonwebtoken');

  let currentSessionId = null;
  if (currentAccessToken) {
    try {
      let decoded;
      try {
        decoded = jwt.verify(currentAccessToken, process.env.JWT_ACCESS_SECRET, {
          algorithms: ['HS256'],
          issuer: process.env.JWT_ISSUER || 'ecommerce-pro',
          audience: process.env.JWT_AUDIENCE || 'ecommerce-pro-client',
        });
      } catch {
        decoded = jwt.verify(currentAccessToken, process.env.JWT_ACCESS_SECRET, {
          algorithms: ['HS256'],
        });
      }
      if (!decoded.purpose) currentSessionId = decoded.sid || null;
    } catch (e) {}
  }

  // Get all active sessions
  const sessions = await RefreshToken.findAll({
    where: { userId, revokedAt: null },
    order: [['lastActiveAt', 'DESC']],
  });

  if (sessions.length <= 1) return { revoked: 0 };

  const keepSessionId = currentSessionId && sessions.some(s => s.id === currentSessionId)
    ? currentSessionId
    : sessions[0].id;

  const toRevoke = sessions.filter(s => s.id !== keepSessionId).map(s => s.id);
  if (toRevoke.length === 0) return { revoked: 0 };

  await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { id: toRevoke } }
  );
  try {
    const blocklist = require('../../utils/tokenBlocklist');
    toRevoke.forEach((sid) => blocklist.revokeSession(sid));
  } catch { /* kill-switch best-effort */ }

  return { revoked: toRevoke.length };
};

const requestPhoneChange = async (userId, newPhone) => {
  const OtpService = require('../auth/otp.service');
  const normalizedPhone = String(newPhone || '').trim();
  const existing = await UserProfile.findOne({ where: { phone: normalizedPhone } });
  if (existing && existing.userId !== userId) {
    throw new AppError('VALIDATION_ERROR', 400, 'This phone number is already in use');
  }
  const otp = await OtpService.generate(normalizedPhone, 'phone_change', null);
  try {
    const NotificationService = require('../notification/notification.service');
    if (NotificationService && NotificationService.send) {
      await NotificationService.send('otp_login', newPhone, { otp, expires_in: '5 minutes' });
    }
  } catch (e) {}
  return { sent: true };
};

const confirmPhoneChange = async (userId, newPhone, code) => {
  const normalizedPhone = String(newPhone || '').trim();
  const OtpService = require('../auth/otp.service');
  await OtpService.verify(normalizedPhone, code, 'phone_change');

  return sequelize.transaction(async (t) => {
    const existing = await UserProfile.findOne({ where: { phone: normalizedPhone }, transaction: t, lock: t.LOCK.UPDATE });
    if (existing && existing.userId !== userId) {
      throw new AppError('CONFLICT', 409, 'This phone number is already registered to another account');
    }
    try {
      let profile = await UserProfile.findOne({ where: { userId }, transaction: t, lock: t.LOCK.UPDATE });
      if (!profile) profile = await UserProfile.create({ userId, phone: normalizedPhone }, { transaction: t });
      else await profile.update({ phone: normalizedPhone }, { transaction: t });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        throw new AppError('CONFLICT', 409, 'This phone number is already registered to another account');
      }
      throw err;
    }
    return { phone: normalizedPhone };
  });
};

const requestEmailChange = async (userId, newEmail, password) => {
  const crypto = require('crypto');
  const { EmailVerificationToken } = require('../index');
  const NotificationService = require('../notification/notification.service');

  const normalizedNewEmail = String(newEmail || '').trim().toLowerCase();

  return sequelize.transaction(async (t) => {
    const user = await User.scope('withPassword').findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
    if (!(await user.validatePassword(password))) throw new AppError('VALIDATION_ERROR', 400, 'Incorrect password');

    const existing = await User.findOne({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), normalizedNewEmail),
      transaction: t,
    });
    if (existing && existing.id !== userId) throw new AppError('VALIDATION_ERROR', 400, 'This email is already in use');

    const token = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(token).digest('hex');

    // Always invalidate prior verification tokens so a stale registration
    // token can never confirm a new pending email (single-token invariant).
    await EmailVerificationToken.destroy({ where: { userId }, transaction: t });
    await EmailVerificationToken.create(
      { userId, token: hashed, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      { transaction: t }
    );

    // Store pending new email on user record
    await user.update({ pendingEmail: normalizedNewEmail }, { transaction: t });

    try {
      if (NotificationService && NotificationService.send) {
        await NotificationService.send('email_change_verification', normalizedNewEmail, {
          name: user.firstName,
          verify_url: `${getClientBaseUrl()}/verify-email-change?token=${token}`,
        }, userId, null, 'email', t);
      }
    } catch (e) {}
    return { sent: true };
  });
};

const confirmEmailChange = async (token) => {
  const crypto = require('crypto');
  const { EmailVerificationToken } = require('../index');
  const hashed = crypto.createHash('sha256').update(token).digest('hex');

  return sequelize.transaction(async (t) => {
    const record = await EmailVerificationToken.findOne({
      where: { token: hashed },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!record || record.expiresAt < new Date()) throw new AppError('VALIDATION_ERROR', 400, 'Invalid or expired token');

    const user = await User.findByPk(record.userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user || !user.pendingEmail) throw new AppError('VALIDATION_ERROR', 400, 'No pending email change');

    const newEmail = String(user.pendingEmail).trim().toLowerCase();
    // Re-verify uniqueness inside transaction to prevent TOCTOU race
    const existing = await User.findOne({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), newEmail),
      transaction: t,
    });
    if (existing && existing.id !== user.id) {
      throw new AppError('CONFLICT', 409, 'This email address is already registered to another account');
    }

    await user.update({ email: newEmail, pendingEmail: null, emailVerified: true }, { transaction: t });
    await record.destroy({ transaction: t });
    return { email: newEmail };
  });
};

const forceLogoutUser = async (userId) => {
  const { RefreshToken } = require('../index');
  const user = await User.findByPk(userId);
  if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

  const active = await RefreshToken.findAll({
    where: { userId, revokedAt: null },
    attributes: ['id'],
  });

  const [revoked] = await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { userId, revokedAt: null } }
  );
  try {
    const blocklist = require('../../utils/tokenBlocklist');
    active.forEach((s) => blocklist.revokeSession(s.id));
  } catch { /* kill-switch best-effort */ }

  return { revoked };
};

module.exports = {
  getMe,
  updateMe,
  updateAvatar,
  changePassword,
  deleteAccount,
  cancelAccountDeletion,
  getSessions,
  revokeSession,
  revokeAllOtherSessions,
  forceLogoutUser,
  requestPhoneChange,
  confirmPhoneChange,
  requestEmailChange,
  confirmEmailChange,
  listAll,
  getById,
  updateStatus,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};
