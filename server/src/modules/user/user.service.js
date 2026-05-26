'use strict';

const { sequelize, User, UserProfile, Order, Address, Media, Role, Permission } = require('../index');
const { Op } = require('sequelize');
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');
const { getPagination } = require('../../utils/pagination');
const { ACTIONS, ENTITIES } = require('../../config/constants');
const logger = require('../../utils/logger');

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

    if (payload.firstName || payload.lastName) {
      await user.update({
        firstName: payload.firstName || user.firstName,
        lastName: payload.lastName || user.lastName
      }, { transaction: t });
    }

    if (payload.phone || payload.gender || payload.dateOfBirth) {
      let profile = await UserProfile.findOne({ where: { userId }, transaction: t });
      if (!profile) {
        profile = await UserProfile.create({ userId }, { transaction: t });
      }
      await profile.update({
        phone: payload.phone || profile.phone,
        gender: payload.gender || profile.gender,
        dateOfBirth: payload.dateOfBirth || profile.dateOfBirth
      }, { transaction: t });
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

const changePassword = async (userId, currentPassword, newPassword) => {
  return sequelize.transaction(async (t) => {
    const user = await User.scope('withPassword').findByPk(userId, { transaction: t });
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

    if (!(await user.validatePassword(currentPassword))) {
      throw new AppError('VALIDATION_ERROR', 400, 'Incorrect current password');
    }

    await user.update({ password: newPassword }, { transaction: t });

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
  if (status) where.status = status;
  if (role) where.role = role;
  if (search && search.trim()) {
    const pattern = `%${search.trim()}%`;
    where[Op.or] = [
      { firstName: { [Op.iLike]: pattern } },
      { lastName: { [Op.iLike]: pattern } },
      { email: { [Op.iLike]: pattern } },
      sequelize.where(
        sequelize.fn('concat', sequelize.col('first_name'), ' ', sequelize.col('last_name')),
        { [Op.iLike]: pattern }
      ),
    ];
  }

  return User.findAndCountAll({
    where,
    limit: lmt,
    offset,
    order: [['createdAt', 'DESC']],
    attributes: { exclude: ['password'] },
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
    attributes: { exclude: ['password'] }
  });

  if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
  return user;
};

const updateStatus = async (id, status, actingUserId) => {
  return sequelize.transaction(async (t) => {
    const user = await User.findByPk(id, { transaction: t });
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
    
    if (user.id === actingUserId) {
        throw new AppError('VALIDATION_ERROR', 400, 'You cannot change your own status');
    }

    const before = user.toJSON();
    await user.update({ status }, { transaction: t });

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

const createAddress = async (userId, payload) => {
  return sequelize.transaction(async (t) => {
    if (payload.isDefault) {
      await Address.update({ isDefault: false }, { where: { userId }, transaction: t });
    } else {
      const addressCount = await Address.count({ where: { userId }, transaction: t });
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

const deleteAccount = async (userId, { password, oauthProvider } = {}) => {
  const { RefreshToken } = require('../index');
  const NotificationService = require('../notification/notification.service');

  return sequelize.transaction(async (t) => {
    const user = await User.scope('withPassword').findByPk(userId, { transaction: t });
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

    // Verify identity: password for email users, oauthProvider flag for OAuth users
    if (oauthProvider) {
      if (!['google'].includes(oauthProvider)) {
        throw new AppError('VALIDATION_ERROR', 400, 'Unsupported OAuth provider');
      }
    } else {
      if (!password) throw new AppError('VALIDATION_ERROR', 400, 'Password is required');
      if (!(await user.validatePassword(password))) {
        throw new AppError('VALIDATION_ERROR', 400, 'Incorrect password');
      }
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
          cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/account?cancelDeletion=true`,
        }, userId, null, t);
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
  const crypto = require('crypto');
  const jwt = require('jsonwebtoken');

  const sessions = await RefreshToken.findAll({
    where: { userId, revokedAt: null },
    attributes: ['id', 'createdByIp', 'deviceName', 'lastActiveAt', 'createdAt', 'token'],
    order: [['lastActiveAt', 'DESC']],
  });

  // Determine current session by matching the access token's user to the most recent refresh
  let currentTokenUserId;
  try {
    const decoded = jwt.verify(currentAccessToken, process.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
    currentTokenUserId = decoded.id;
  } catch (e) {}

  // The most recently active session for this user is the current one
  return sessions.map((s, idx) => ({
    id: s.id,
    deviceName: s.deviceName || 'Unknown device',
    ipAddress: s.createdByIp,
    lastActiveAt: s.lastActiveAt || s.createdAt,
    createdAt: s.createdAt,
    isCurrent: currentTokenUserId ? idx === 0 : false,
  }));
};

const revokeSession = async (userId, sessionId) => {
  const { RefreshToken } = require('../index');
  const session = await RefreshToken.findOne({ where: { id: sessionId, userId, revokedAt: null } });
  if (!session) throw new AppError('NOT_FOUND', 404, 'Session not found');
  await session.update({ revokedAt: new Date() });
};

const revokeAllOtherSessions = async (userId, currentAccessToken) => {
  const { RefreshToken } = require('../index');

  // Get all active sessions, revoke all except the most recently active one
  const sessions = await RefreshToken.findAll({
    where: { userId, revokedAt: null },
    order: [['lastActiveAt', 'DESC']],
  });

  if (sessions.length <= 1) return { revoked: 0 };

  const currentSessionId = sessions[0].id;
  const toRevoke = sessions.slice(1).map(s => s.id);

  await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { id: toRevoke } }
  );

  return { revoked: toRevoke.length };
};

const requestPhoneChange = async (userId, newPhone) => {
  const OtpService = require('../auth/otp.service');
  const existing = await UserProfile.findOne({ where: { phone: newPhone } });
  if (existing && existing.userId !== userId) {
    throw new AppError('VALIDATION_ERROR', 400, 'This phone number is already in use');
  }
  const otp = await OtpService.generate(newPhone, 'phone_change', null);
  try {
    const NotificationService = require('../notification/notification.service');
    if (NotificationService && NotificationService.send) {
      await NotificationService.send('otp_login', newPhone, { otp, expires_in: '5 minutes' });
    }
  } catch (e) {}
  return { sent: true };
};

const confirmPhoneChange = async (userId, newPhone, code) => {
  const OtpService = require('../auth/otp.service');
  await OtpService.verify(newPhone, code, 'phone_change');
  let profile = await UserProfile.findOne({ where: { userId } });
  if (!profile) profile = await UserProfile.create({ userId, phone: newPhone });
  else await profile.update({ phone: newPhone });
  return { phone: newPhone };
};

const requestEmailChange = async (userId, newEmail, password) => {
  const crypto = require('crypto');
  const { EmailVerificationToken } = require('../index');
  const NotificationService = require('../notification/notification.service');

  const user = await User.scope('withPassword').findByPk(userId);
  if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
  if (!(await user.validatePassword(password))) throw new AppError('VALIDATION_ERROR', 400, 'Incorrect password');

  const existing = await User.findOne({ where: { email: newEmail } });
  if (existing) throw new AppError('VALIDATION_ERROR', 400, 'This email is already in use');

  const token = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  await EmailVerificationToken.destroy({ where: { userId } });
  await EmailVerificationToken.create({ userId, token: hashed, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });

  // Store pending new email on user record
  await user.update({ pendingEmail: newEmail });

  try {
    if (NotificationService && NotificationService.send) {
      await NotificationService.send('email_change_verification', newEmail, {
        name: user.firstName,
        verify_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email-change?token=${token}`,
      }, userId);
    }
  } catch (e) {}
  return { sent: true };
};

const confirmEmailChange = async (token) => {
  const crypto = require('crypto');
  const { EmailVerificationToken } = require('../index');
  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  const record = await EmailVerificationToken.findOne({ where: { token: hashed } });
  if (!record || record.expiresAt < new Date()) throw new AppError('VALIDATION_ERROR', 400, 'Invalid or expired token');

  const user = await User.findByPk(record.userId);
  if (!user || !user.pendingEmail) throw new AppError('VALIDATION_ERROR', 400, 'No pending email change');

  const newEmail = user.pendingEmail;
  await user.update({ email: newEmail, pendingEmail: null });
  await record.destroy();
  return { email: newEmail };
};

const forceLogoutUser = async (userId) => {
  const { RefreshToken } = require('../index');
  const user = await User.findByPk(userId);
  if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

  const [revoked] = await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { userId, revokedAt: null } }
  );

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
