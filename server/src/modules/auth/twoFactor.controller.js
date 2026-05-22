'use strict';

const TwoFactorService = require('./twoFactor.service');
const { success } = require('../../utils/response');

const setup = async (req, res, next) => {
  try {
    const result = await TwoFactorService.setup(req.user.id);
    return success(res, result, '2FA setup initiated. Scan the QR code and verify.');
  } catch (err) { next(err); }
};

const enable = async (req, res, next) => {
  try {
    const result = await TwoFactorService.enable(req.user.id, req.validated.code);
    return success(res, result, '2FA enabled successfully');
  } catch (err) { next(err); }
};

const disable = async (req, res, next) => {
  try {
    const result = await TwoFactorService.disable(req.user.id, req.validated.code);
    return success(res, result, '2FA disabled successfully');
  } catch (err) { next(err); }
};

const regenerateBackupCodes = async (req, res, next) => {
  try {
    const result = await TwoFactorService.regenerateBackupCodes(req.user.id, req.validated.code);
    return success(res, result, 'New backup codes generated. Save them securely.');
  } catch (err) { next(err); }
};

module.exports = { setup, enable, disable, regenerateBackupCodes };
