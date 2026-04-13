'use strict';

const { sequelize, User, UserProfile, Order, Address, Media, Role, Permission } = require('../index');
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

const listAll = async ({ page, limit, status, role }) => {
  const { limit: lmt, offset } = getPagination(page, limit);
  const where = {};
  if (status) where.status = status;
  if (role) where.role = role;

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
      // Recent orders excluded — load separately via GET /api/orders?userId=:id
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

module.exports = {
  getMe,
  updateMe,
  updateAvatar,
  changePassword,
  listAll,
  getById,
  updateStatus,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};
