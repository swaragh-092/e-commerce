'use strict';

const SettingsService = require('./settings.service');
const { success } = require('../../utils/response');
const { getMode } = require('../../config/modes');

const getAll = async (req, res, next) => {
  try {
    const result = await SettingsService.getAll();
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const getByGroup = async (req, res, next) => {
  try {
    const result = await SettingsService.getByGroup(req.params.group);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const updateSingle = async (req, res, next) => {
  try {
    const { key } = req.params;
    // We expect the payload to look like { value: "some-value", group: "general" }
    // Group is optional if the setting already exists, but required for new ones.
    const { value, group } = req.body; 
    
    // In actual implementation req.body is validated by validation.js which only ensures 'value' is present
    const result = await SettingsService.updateKey(key, value, req.query.group || 'general', req.user.id);
    return success(res, result, 'Setting updated successfully');
  } catch (err) {
    next(err);
  }
};

const updateBulk = async (req, res, next) => {
  try {
    await SettingsService.bulkUpdate(req.body, req.user.id);
    return success(res, null, 'Settings bulk updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/features
 * Public endpoint — returns the fully resolved feature map for the current mode.
 * Frontend uses this to conditionally render/hide UI elements.
 * Includes the active mode name so clients can adapt their behaviour.
 */
const getFeatures = async (req, res, next) => {
  try {
    const { features, lockedKeys } = await SettingsService.getFeatures();
    return success(res, { mode: getMode(), features, lockedKeys });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getByGroup, updateSingle, updateBulk, getFeatures };
