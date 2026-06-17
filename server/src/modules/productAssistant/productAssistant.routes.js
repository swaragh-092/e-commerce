'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./productAssistant.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizeAnyPermission } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { documentMemoryUpload } = require('../../middleware/upload.middleware');
const { aiAssistantLimiter } = require('../../middleware/rateLimiter.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const { generateDraftSchema } = require('./productAssistant.validation');

// POST /product-assistant/generate
// Converts a short admin text prompt into a full product content draft.
router.post(
  '/product-assistant/generate',
  authenticate,
  authorizeAnyPermission(PERMISSIONS.PRODUCTS_CREATE, PERMISSIONS.PRODUCTS_UPDATE),
  aiAssistantLimiter,
  validate(generateDraftSchema),
  controller.generate
);

// POST /product-assistant/extract-specs
// Accepts a PDF spec sheet and extracts structured product attributes.
router.post(
  '/product-assistant/extract-specs',
  authenticate,
  authorizeAnyPermission(PERMISSIONS.PRODUCTS_CREATE, PERMISSIONS.PRODUCTS_UPDATE),
  aiAssistantLimiter,
  documentMemoryUpload.single('file'),
  controller.extractSpecs
);

module.exports = router;
