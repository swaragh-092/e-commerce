'use strict';

const SettingsService = require('./settings.service');
const DesignDraftService = require('./designDraft.service');
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

const getDesignState = async (req, res, next) => {
  try {
    const result = await SettingsService.getDesignState();
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const resetDesignSetting = async (req, res, next) => {
  try {
    const result = await SettingsService.resetDesignSetting(req.body, req.user.id);
    return success(res, result, 'Visual setting reset to default.');
  } catch (err) {
    next(err);
  }
};

const getDesignDraft = async (req, res, next) => {
  try {
    return success(res, await DesignDraftService.getDraft());
  } catch (err) {
    next(err);
  }
};

const getDesignVersions = async (req, res, next) => {
  try {
    return success(res, await DesignDraftService.getPublishedVersions({ limit: req.query.limit }));
  } catch (err) {
    next(err);
  }
};

const saveDesignDraft = async (req, res, next) => {
  try {
    const draft = await DesignDraftService.saveDraft(req.body, req.user);
    return success(res, draft, 'Design draft saved.');
  } catch (err) {
    next(err);
  }
};

const publishDesignDraft = async (req, res, next) => {
  try {
    const result = await DesignDraftService.publishDraft(req.body, req.user);
    return success(res, result, 'Design draft published.');
  } catch (err) {
    next(err);
  }
};

const restoreDesignVersion = async (req, res, next) => {
  try {
    return success(res, await DesignDraftService.restorePublishedVersion({
      versionId: req.params.id,
      expectedRevision: req.body.expectedRevision,
    }, req.user), 'Published design version restored into draft.');
  } catch (err) {
    next(err);
  }
};

const discardDesignDraft = async (req, res, next) => {
  try {
    const result = await DesignDraftService.discardDraft(req.user);
    return success(res, result, 'Design draft discarded.');
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
    const resolvedGroup = req.query.group || group || 'general';
    const result = await SettingsService.updateKey(key, value, resolvedGroup, req.user.id, req.user);
    return success(res, result, 'Setting updated successfully');
  } catch (err) {
    next(err);
  }
};

const updateBulk = async (req, res, next) => {
  try {
    await SettingsService.bulkUpdate(req.body, req.user.id, req.user);
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
    const { features, lockedKeys, mode } = await SettingsService.getFeatures();
    return success(res, { mode, features, lockedKeys });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getByGroup,
  getDesignState,
  resetDesignSetting,
  getDesignDraft,
  getDesignVersions,
  saveDesignDraft,
  publishDesignDraft,
  restoreDesignVersion,
  discardDesignDraft,
  updateSingle,
  updateBulk,
  getFeatures,
};
