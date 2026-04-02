'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { updateSingleSettingSchema, bulkUpdateSchema } = require('./settings.validation');
const settingsController = require('./settings.controller');

// Public endpoints
router.get('/', settingsController.getAll);
router.get('/:group', settingsController.getByGroup);

// Admin-only endpoints
router.put('/bulk',
  authenticate,
  authorize('admin', 'super_admin'),
  validate(bulkUpdateSchema),
  settingsController.updateBulk
);

router.put('/:key',
  authenticate,
  authorize('admin', 'super_admin'),
  validate(updateSingleSettingSchema),
  settingsController.updateSingle
);

module.exports = router;
