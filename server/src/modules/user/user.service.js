'use strict';

const { sequelize } = require('../../config/database');
const { User, UserProfile, Order, Address, Media } = require('../../models');
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');
const { getPagination } = require('../../utils/pagination');

const getMe = async (userId) => {
  const user = await User.findByPk(userId, {
    include: [
      { model: UserProfile, as: 'profile' }
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
          action: 'UPDATE',
          entity: 'User',
          entityId: userId,
          changes: { before, after: updatedUser.toJSON() }
        }, t);
      }
    } catch(err) {}

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
          action: 'UPDATE_AVATAR',
          entity: 'User',
          entityId: userId,
          changes: { avatar: media.url }
        }, t);
      }
    } catch(err) {}

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
    attributes: { exclude: ['password'] }
  });
};

const getById = async (id) => {
  const user = await User.findByPk(id, {
    include: [
      { model: UserProfile, as: 'profile' },
      { model: Order, limit: 5, order: [['createdAt', 'DESC']] }
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
          action: 'STATUS_CHANGE',
          entity: 'User',
          entityId: id,
          changes: { before: before.status, after: status }
        }, t);
      }
    } catch(err) {}

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
    
    return Address.create({ ...payload, userId }, { transaction: t });
  });
};

const updateAddress = async (userId, addressId, payload) => {
  return sequelize.transaction(async (t) => {
    const address = await Address.findOne({ where: { id: addressId, userId }, transaction: t });
    if (!address) throw new AppError('NOT_FOUND', 404, 'Address not found');

    if (payload.isDefault && !address.isDefault) {
      await Address.update({ isDefault: false }, { where: { userId }, transaction: t });
    }

    await address.update(payload, { transaction: t });
    return address;
  });
};

const deleteAddress = async (userId, addressId) => {
  return sequelize.transaction(async (t) => {
    const address = await Address.findOne({ where: { id: addressId, userId }, transaction: t });
    if (!address) throw new AppError('NOT_FOUND', 404, 'Address not found');

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
  });
};

const setDefaultAddress = async (userId, addressId) => {
  return sequelize.transaction(async (t) => {
    const address = await Address.findOne({ where: { id: addressId, userId }, transaction: t });
    if (!address) throw new AppError('NOT_FOUND', 404, 'Address not found');

    if (!address.isDefault) {
      await Address.update({ isDefault: false }, { where: { userId }, transaction: t });
      await address.update({ isDefault: true }, { transaction: t });
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
