'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { updateSingleSettingSchema, bulkUpdateSchema } = require('./settings.validation');
const {
  saleLabelBodySchema,
  updateSaleLabelBodySchema,
  replaceSaleLabelsBodySchema,
} = require('./saleLabel.validation');
const settingsController = require('./settings.controller');
const saleLabelController = require('./saleLabel.controller');
const { PERMISSIONS } = require('../../config/permissions');

// ─── Sale Label routes (must come BEFORE the /:group wildcard) ───────────────
// Public — used to populate dropdowns in the storefront & admin product forms
router.get('/sale-labels', saleLabelController.list);

// Admin — CRUD
router.post('/sale-labels',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(saleLabelBodySchema),
  saleLabelController.create
);

router.put('/sale-labels',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(replaceSaleLabelsBodySchema),
  saleLabelController.replaceAll
);

router.patch('/sale-labels/:id',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(updateSaleLabelBodySchema),
  saleLabelController.update
);

router.delete('/sale-labels/:id',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  saleLabelController.remove
);

// ─── Generic settings routes ─────────────────────────────────────────────────
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
