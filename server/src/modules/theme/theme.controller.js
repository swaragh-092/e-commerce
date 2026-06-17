'use strict';

const ThemeService = require('./theme.service');
const { success } = require('../../utils/response');
const { applyRequestSchema, previewRequestSchema, importRequestSchema, idParamSchema } = require('./theme.validation');

const getBuiltin = async (req, res, next) => {
  try {
    const themes = ThemeService.listBuiltin();
    return success(res, themes);
  } catch (err) { next(err); }
};

const getLibrary = async (req, res, next) => {
  try {
    const themes = await ThemeService.listLibrary(req.query);
    return success(res, themes);
  } catch (err) { next(err); }
};

const getActivations = async (req, res, next) => {
  try {
    const activations = await ThemeService.listActivations();
    return success(res, activations);
  } catch (err) { next(err); }
};

const validate = async (req, res, next) => {
  try {
    if (!req.body || !req.body.packageData) {
      return res.status(400).json({ success: false, message: 'Invalid request: missing packageData' });
    }
    const validated = ThemeService.validatePackage(req.body.packageData);
    return success(res, { valid: true, package: validated }, 'Package is valid');
  } catch (err) { next(err); }
};

const preview = async (req, res, next) => {
  try {
    const { error, value } = previewRequestSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const result = await ThemeService.preview(value.packageData, value.scopes);
    return success(res, result);
  } catch (err) { next(err); }
};

const importTheme = async (req, res, next) => {
  try {
    const { error, value } = importRequestSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const pkg = await ThemeService.importToLibrary(value.packageData, req.user.id);
    return success(res, pkg, 'Theme imported to library');
  } catch (err) { next(err); }
};

const exportTheme = async (req, res, next) => {
  try {
    const pkg = await ThemeService.exportCurrent(req.body || {});
    return success(res, pkg);
  } catch (err) { next(err); }
};

const applyTheme = async (req, res, next) => {
  try {
    const { error, value } = applyRequestSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const activation = await ThemeService.apply(value.packageData, { scopes: value.scopes, replaceDemoContent: value.replaceDemoContent }, req.user);
    return success(res, { activationId: activation.id }, 'Theme applied successfully');
  } catch (err) { next(err); }
};

const rollbackActivation = async (req, res, next) => {
  try {
    const { error } = idParamSchema.validate(req.params);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const activation = await ThemeService.rollback(req.params.id, req.user);
    return success(res, activation, 'Theme rolled back successfully');
  } catch (err) { next(err); }
};

const removeLibrary = async (req, res, next) => {
  try {
    const { error } = idParamSchema.validate(req.params);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    await ThemeService.removeLibraryTheme(req.params.id, req.user.id);
    return success(res, null, 'Theme removed from library');
  } catch (err) { next(err); }
};

const getStoreStatus = async (req, res, next) => {
  try {
    const status = await ThemeService.getStoreStatus();
    return success(res, status);
  } catch (err) { next(err); }
};

module.exports = { getBuiltin, getLibrary, getActivations, validate, preview, importTheme, exportTheme, applyTheme, rollbackActivation, removeLibrary, getStoreStatus };
