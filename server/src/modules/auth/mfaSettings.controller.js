'use strict';
const service = require('./mfaSettings.service');
const { success } = require('../../utils/response');
const get = async (req, res, next) => {
  try { return success(res, await service.get(req.user)); } catch (error) { next(error); }
};
const update = async (req, res, next) => {
  try {
    return success(res, await service.update(req.user, req.validated, { ip: req.ip, userAgent: req.headers['user-agent'] }), 'MFA policy saved');
  } catch (error) { next(error); }
};
module.exports = { get, update };
