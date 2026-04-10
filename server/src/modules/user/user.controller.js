'use strict';

const UserService = require('./user.service');
const { success, paginated } = require('../../utils/response');
const { enrichUserAuthorization } = require('../../config/permissions');

const getMe = async (req, res, next) => {
  try {
    const user = await UserService.getMe(req.user.id);
    return success(res, enrichUserAuthorization(user));
  } catch (err) {
    next(err);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const user = await UserService.updateMe(req.user.id, req.validated);
    return success(res, enrichUserAuthorization(user), 'Profile updated successfully');
  } catch (err) {
    next(err);
  }
};

const updateAvatar = async (req, res, next) => {
  try {
    // Support both direct file upload and legacy { mediaId } JSON body
    if (req.file) {
      const mediaService = require('../media/media.service');
      const media = await mediaService.uploadMedia(req.file);
      const user = await UserService.updateAvatar(req.user.id, media.id);
      return success(res, enrichUserAuthorization(user), 'Avatar updated successfully');
    }

    const { mediaId } = req.body;
    if (!mediaId) {
      return next(Object.assign(new Error('No file or mediaId provided'), { statusCode: 400 }));
    }
    const user = await UserService.updateAvatar(req.user.id, mediaId);
    return success(res, enrichUserAuthorization(user), 'Avatar updated successfully');
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.validated;
    await UserService.changePassword(req.user.id, currentPassword, newPassword);
    return success(res, null, 'Password changed successfully');
  } catch (err) {
    next(err);
  }
};

// Admin Endpoints
const list = async (req, res, next) => {
  try {
    const { page, limit, status, role } = req.query;
    const result = await UserService.listAll({ page, limit, status, role });
    return paginated(res, result.rows.map((user) => enrichUserAuthorization(user)), result.count, page, limit);
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const user = await UserService.getById(req.params.id);
    return success(res, enrichUserAuthorization(user));
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const user = await UserService.updateStatus(req.params.id, req.validated.status, req.user.id);
    return success(res, enrichUserAuthorization(user), 'User status updated successfully');
  } catch (err) {
    next(err);
  }
};

const getAddresses = async (req, res, next) => {
  try {
    const addresses = await UserService.getAddresses(req.user.id);
    return success(res, addresses);
  } catch (err) {
    next(err);
  }
};

const createAddress = async (req, res, next) => {
  try {
    const address = await UserService.createAddress(req.user.id, req.validated);
    return success(res, address, 'Address added successfully', 201);
  } catch (err) {
    next(err);
  }
};

const updateAddress = async (req, res, next) => {
  try {
    const address = await UserService.updateAddress(req.user.id, req.params.id, req.validated);
    return success(res, address, 'Address updated successfully');
  } catch (err) {
    next(err);
  }
};

const deleteAddress = async (req, res, next) => {
  try {
    await UserService.deleteAddress(req.user.id, req.params.id);
    return success(res, null, 'Address deleted successfully');
  } catch (err) {
    next(err);
  }
};

const setDefaultAddress = async (req, res, next) => {
  try {
    const address = await UserService.setDefaultAddress(req.user.id, req.params.id);
    return success(res, address, 'Default address updated successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMe,
  updateMe,
  updateAvatar,
  changePassword,
  list,
  getOne,
  updateStatus,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};
