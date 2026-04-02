'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./attribute.controller');
const { validate } = require('../../middleware/validate.middleware');
const { linkAttributeSchema } = require('./attribute.validation');

// NOTE: When auth middleware is ready, add authenticate + authorize('admin', 'super_admin')

// --- Category-Attribute linking ---
router.get('/:id/attributes', controller.getCategoryAttributes);
router.post('/:id/attributes', validate(linkAttributeSchema), controller.linkAttributeToCategory);
router.delete('/:id/attributes/:attrId', controller.unlinkAttributeFromCategory);

module.exports = router;
