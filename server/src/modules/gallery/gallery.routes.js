'use strict';
const express = require('express');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { idParamSchema } = require('../../utils/common.validation');
const { PERMISSIONS } = require('../../config/permissions');
const c = require('./gallery.controller');
const v = require('./gallery.validation');

const router = express.Router();

router.get('/public/:slug', validate(v.publicGalleryQuerySchema, 'query'), c.publicView);
router.get('/', authenticate, authorizePermissions(PERMISSIONS.MEDIA_READ), validate(v.listQuerySchema, 'query'), c.listAdmin);
router.post('/', authenticate, authorizePermissions(PERMISSIONS.MEDIA_UPDATE), validate(v.createGallerySchema), c.create);
router.patch('/:id', authenticate, authorizePermissions(PERMISSIONS.MEDIA_UPDATE), validate(idParamSchema, 'params'), validate(v.updateGallerySchema), c.update);
router.delete('/:id', authenticate, authorizePermissions(PERMISSIONS.MEDIA_DELETE), validate(idParamSchema, 'params'), c.remove);
router.post('/:id/items', authenticate, authorizePermissions(PERMISSIONS.MEDIA_UPDATE), validate(idParamSchema, 'params'), validate(v.addItemsSchema), c.addItems);
router.delete('/:id/items/:itemId', authenticate, authorizePermissions(PERMISSIONS.MEDIA_DELETE), validate(v.idAndItemIdParamSchema, 'params'), c.removeItem);
router.patch('/:id/reorder', authenticate, authorizePermissions(PERMISSIONS.MEDIA_UPDATE), validate(idParamSchema, 'params'), validate(v.reorderItemsSchema), c.reorderItems);

module.exports = router;
