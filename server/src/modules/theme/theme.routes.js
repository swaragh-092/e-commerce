'use strict';

const express = require('express');
const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { featureGate } = require('../../middleware/featureGate.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const controller = require('./theme.controller');

// The global body parser at app.js already mounted express.json() and
// consumed the request body stream, so re-mounting a parser with a smaller
// limit here would be a no-op. Enforce the 500kb cap in the import handler
// via a verify-style size check on req.body instead. This keeps the cap
// honest even though the stream has already been read.
const MAX_THEME_IMPORT_BYTES = 500 * 1024;
const enforceThemeImportSize = (req, res, next) => {
  if (req.body && Buffer.byteLength(JSON.stringify(req.body), 'utf8') > MAX_THEME_IMPORT_BYTES) {
    return res.status(413).json({ success: false, message: 'Theme package exceeds 500kb limit.' });
  }
  return next();
};

const read = [authenticate, authorizePermissions(PERMISSIONS.SETTINGS_READ), featureGate('themes')];
const manage = [authenticate, authorizePermissions(PERMISSIONS.SETTINGS_MANAGE), featureGate('themes')];

router.get('/builtin', ...read, controller.getBuiltin);
router.get('/library', ...read, controller.getLibrary);
router.get('/activations', ...read, controller.getActivations);
router.get('/store-status', ...read, controller.getStoreStatus);
router.post('/validate', ...read, controller.validate);
router.post('/preview', ...read, controller.preview);
router.post('/import', ...manage, enforceThemeImportSize, controller.importTheme);
router.post('/export', ...read, controller.exportTheme);
router.post('/apply', ...manage, enforceThemeImportSize, controller.applyTheme);
router.post('/activations/:id/rollback', ...manage, controller.rollbackActivation);
router.delete('/library/:id', ...manage, controller.removeLibrary);

module.exports = router;
