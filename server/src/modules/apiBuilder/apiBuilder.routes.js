'use strict';

const express = require('express');
const controller = require('./apiBuilder.controller');
const validation = require('./apiBuilder.validation');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizeAnyPermission, authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { featureGate } = require('../../middleware/featureGate.middleware');
const { publicApiLimiter } = require('../../middleware/rateLimiter.middleware');
const { auditLog } = require('../audit/audit.middleware');
const { PERMISSIONS } = require('../../config/permissions');

const router = express.Router();

router.get(
  '/public/:slug',
  publicApiLimiter,
  featureGate('apiBuilder'),
  validate(validation.slugParamSchema, 'params'),
  controller.executeBySlug
);

router.get(
  '/',
  authenticate,
  featureGate('apiBuilder'),
  authorizeAnyPermission(PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_MANAGE),
  validate(validation.querySchema, 'query'),
  controller.list
);

router.post(
  '/preview',
  authenticate,
  featureGate('apiBuilder'),
  authorizeAnyPermission(PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_MANAGE),
  validate(validation.previewApiDefinitionSchema),
  controller.preview
);

router.post(
  '/',
  authenticate,
  featureGate('apiBuilder'),
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  auditLog('ApiDefinition'),
  validate(validation.createApiDefinitionSchema),
  controller.create
);

router.get(
  '/:id',
  authenticate,
  featureGate('apiBuilder'),
  authorizeAnyPermission(PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_MANAGE),
  validate(validation.idParamSchema, 'params'),
  controller.getById
);

router.put(
  '/:id',
  authenticate,
  featureGate('apiBuilder'),
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  auditLog('ApiDefinition'),
  validate(validation.idParamSchema, 'params'),
  validate(validation.updateApiDefinitionSchema),
  controller.update
);

router.delete(
  '/:id',
  authenticate,
  featureGate('apiBuilder'),
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  auditLog('ApiDefinition'),
  validate(validation.idParamSchema, 'params'),
  controller.delete
);

module.exports = router;
