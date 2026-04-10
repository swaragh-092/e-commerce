'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { updateSingleSettingSchema, bulkUpdateSchema } = require('./settings.validation');
const settingsController = require('./settings.controller');
const { PERMISSIONS } = require('../../config/permissions');

// Public endpoints
router.get('/', settingsController.getAll);
router.get('/:group', settingsController.getByGroup);

// Admin-only endpoints
router.put('/bulk',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(bulkUpdateSchema),
  settingsController.updateBulk
);

router.put('/:key',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(updateSingleSettingSchema),
  settingsController.updateSingle
);

module.exports = router;
