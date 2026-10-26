'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const {
  updateSingleSettingSchema,
  bulkUpdateSchema,
  resetDesignSettingSchema,
  saveDesignDraftSchema,
  publishDesignDraftSchema,
  restoreDesignVersionSchema,
} = require('./settings.validation');
const {
  saleLabelBodySchema,
  updateSaleLabelBodySchema,
  replaceSaleLabelsBodySchema,
} = require('./saleLabel.validation');
const settingsController = require('./settings.controller');
const saleLabelController = require('./saleLabel.controller');
const { getUnitUsage } = require('./unitCatalog');
const { success } = require('../../utils/response');
const { PERMISSIONS } = require('../../config/permissions');
const { idParamSchema, stringIdParamSchema } = require('../../utils/common.validation');


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
  validate(stringIdParamSchema, 'params'),
  validate(updateSaleLabelBodySchema),
  saleLabelController.update
);


router.delete('/sale-labels/:id',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(stringIdParamSchema, 'params'),
  saleLabelController.remove
);


// ─── Generic settings routes ─────────────────────────────────────────────────
// Unit usage is admin-only; keep it before the /:group wildcard.
router.get('/unit-usage', authenticate, authorizePermissions(PERMISSIONS.SETTINGS_MANAGE), async (req, res, next) => {
  try {
    return success(res, await getUnitUsage());
  } catch (error) {
    next(error);
  }
});

// GET /api/features — fully resolved feature map (mode core + DB overrides).
// Must be declared BEFORE /:group so Express doesn't treat "features" as a group param.
router.get('/features', settingsController.getFeatures);

router.get('/design-state',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  settingsController.getDesignState
);

router.get('/design-draft',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  settingsController.getDesignDraft
);

router.get('/design-versions',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  settingsController.getDesignVersions
);

router.post('/design-draft',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(saveDesignDraftSchema),
  settingsController.saveDesignDraft
);

router.post('/design-draft/publish',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(publishDesignDraftSchema),
  settingsController.publishDesignDraft
);

router.post('/design-versions/:id/restore',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(idParamSchema, 'params'),
  validate(restoreDesignVersionSchema),
  settingsController.restoreDesignVersion
);

router.delete('/design-draft',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  settingsController.discardDesignDraft
);

// Public storefront settings use an explicit allowlist. The authenticated
// endpoints retain full admin data and require settings.read.
router.get('/public', settingsController.getPublicAll);
router.get('/public/:group', settingsController.getPublicByGroup);

router.get('/',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_READ),
  settingsController.getAll
);
router.get('/:group',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_READ),
  settingsController.getByGroup
);

// Admin-only endpoints
router.put('/bulk',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(bulkUpdateSchema),
  settingsController.updateBulk
);

router.post('/design-reset',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(resetDesignSettingSchema),
  settingsController.resetDesignSetting
);

router.put('/:key',
  authenticate,
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(updateSingleSettingSchema),
  settingsController.updateSingle
);

module.exports = router;
