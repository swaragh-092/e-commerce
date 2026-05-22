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
    const { mediaId } = req.validated;
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
    const { page, limit, status, role, search } = req.query;
    const result = await UserService.listAll({ page, limit, status, role, search });
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

const deleteAccount = async (req, res, next) => {
  try {
    const result = await UserService.deleteAccount(req.user.id, req.validated);
    return success(res, result, `Account scheduled for deletion on ${result.scheduledDeletionAt.toLocaleDateString()}`);
  } catch (err) { next(err); }
};

const cancelAccountDeletion = async (req, res, next) => {
  try {
    const result = await UserService.cancelAccountDeletion(req.user.id);
    return success(res, result, 'Account deletion cancelled');
  } catch (err) { next(err); }
};

const getSessions = async (req, res, next) => {
  try {
    const result = await UserService.getSessions(req.user.id, req.headers.authorization?.split(' ')[1]);
    return success(res, result);
  } catch (err) { next(err); }
};

const revokeSession = async (req, res, next) => {
  try {
    await UserService.revokeSession(req.user.id, req.params.id);
    return success(res, null, 'Session revoked');
  } catch (err) { next(err); }
};

const revokeAllOtherSessions = async (req, res, next) => {
  try {
    const result = await UserService.revokeAllOtherSessions(req.user.id, req.headers.authorization?.split(' ')[1]);
    return success(res, result, 'All other sessions revoked');
  } catch (err) { next(err); }
};

const forceLogout = async (req, res, next) => {
  try {
    const result = await UserService.forceLogoutUser(req.params.id);
    return success(res, result, 'User sessions revoked');
  } catch (err) { next(err); }
};

const requestPhoneChange = async (req, res, next) => {
  try {
    const result = await UserService.requestPhoneChange(req.user.id, req.validated.phone);
    return success(res, result, 'OTP sent to new phone number');
  } catch (err) { next(err); }
};

const confirmPhoneChange = async (req, res, next) => {
  try {
    const result = await UserService.confirmPhoneChange(req.user.id, req.validated.phone, req.validated.code);
    return success(res, result, 'Phone number updated');
  } catch (err) { next(err); }
};

const requestEmailChange = async (req, res, next) => {
  try {
    const result = await UserService.requestEmailChange(req.user.id, req.validated.newEmail, req.validated.password);
    return success(res, result, 'Verification email sent to new address');
  } catch (err) { next(err); }
};

const confirmEmailChange = async (req, res, next) => {
  try {
    const result = await UserService.confirmEmailChange(req.validated.token);
    return success(res, result, 'Email updated successfully');
  } catch (err) { next(err); }
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
  forceLogout,
  requestPhoneChange,
  confirmPhoneChange,
  requestEmailChange,
  confirmEmailChange,
  list,
  getOne,
  updateStatus,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};
