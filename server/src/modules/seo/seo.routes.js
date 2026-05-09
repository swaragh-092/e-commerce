const express = require('express');
const seoController = require('./seo.controller');
const seoOverrideController = require('./seoOverride.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { auditLog } = require('../audit/audit.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const { featureGate } = require('../../middleware/featureGate.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { idParamSchema } = require('../../utils/common.validation');


const router = express.Router();

// Apply SEO feature gate to all routes in this module
router.use(featureGate('seo'));

// Public routes
router.get('/sitemap.xml', seoController.getSitemap);
router.get('/robots.txt', seoController.getRobots);
router.get('/metadata', seoController.getMetadata);

// Admin routes - Overrides management
router.get('/overrides', authenticate, authorizePermissions(PERMISSIONS.SETTINGS_READ), seoOverrideController.getAll);
router.get('/overrides/:id', authenticate, authorizePermissions(PERMISSIONS.SETTINGS_READ), validate(idParamSchema, 'params'), seoOverrideController.getById);
router.post('/overrides', authenticate, authorizePermissions(PERMISSIONS.SETTINGS_MANAGE), auditLog('SEO_OVERRIDE'), seoOverrideController.create);
router.put('/overrides/:id', authenticate, authorizePermissions(PERMISSIONS.SETTINGS_MANAGE), validate(idParamSchema, 'params'), auditLog('SEO_OVERRIDE'), seoOverrideController.update);
router.delete('/overrides/:id', authenticate, authorizePermissions(PERMISSIONS.SETTINGS_MANAGE), validate(idParamSchema, 'params'), auditLog('SEO_OVERRIDE'), seoOverrideController.delete);


module.exports = router;
