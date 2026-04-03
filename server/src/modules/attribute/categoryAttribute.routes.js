'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./attribute.controller');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');
const { linkAttributeSchema } = require('./attribute.validation');

const adminOnly = [authenticate, authorize('admin', 'super_admin')];

// --- Category-Attribute linking ---
router.get('/:id/attributes', controller.getCategoryAttributes);
router.post('/:id/attributes', ...adminOnly, validate(linkAttributeSchema), controller.linkAttributeToCategory);
router.delete('/:id/attributes/:attrId', ...adminOnly, controller.unlinkAttributeFromCategory);

module.exports = router;
