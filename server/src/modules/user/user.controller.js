'use strict';

const UserService = require('./user.service');
const { success, paginated } = require('../../utils/response');

const getMe = async (req, res, next) => {
  try {
    const user = await UserService.getMe(req.user.id);
    return success(res, user);
  } catch (err) {
    next(err);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const user = await UserService.updateMe(req.user.id, req.validated);
    return success(res, user, 'Profile updated successfully');
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
    return paginated(res, result.rows, { page, limit, total: result.count });
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const user = await UserService.getById(req.params.id);
    return success(res, user);
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const user = await UserService.updateStatus(req.params.id, req.validated.status, req.user.id);
    return success(res, user, 'User status updated successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMe,
  updateMe,
  changePassword,
  list,
  getOne,
  updateStatus
};
