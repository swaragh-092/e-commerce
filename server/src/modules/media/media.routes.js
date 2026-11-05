'use strict';
const express = require('express');
const router = express.Router();
const mediaController = require('./media.controller');
const cropPresetController = require('./cropPreset.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { auditLog } = require('../audit/audit.middleware');
const { memoryUpload, fontUpload } = require('../../middleware/upload.middleware');
const { mediaUploadLimiter } = require('../../middleware/rateLimiter.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const { validate } = require('../../middleware/validate.middleware');
const { idParamSchema } = require('../../utils/common.validation');
const { updateMediaSchema, listMediaSchema, cropPresetSchema } = require('./media.validation');

// Keep named routes before the generic /:id media routes.
router.get('/crop-presets', authenticate, authorizePermissions(PERMISSIONS.MEDIA_UPLOAD), cropPresetController.list);
router.post('/crop-presets', authenticate, authorizePermissions(PERMISSIONS.MEDIA_UPLOAD), validate(cropPresetSchema), auditLog('CropPreset'), cropPresetController.create);
router.patch('/crop-presets/:id', authenticate, authorizePermissions(PERMISSIONS.MEDIA_UPLOAD), validate(idParamSchema, 'params'), validate(cropPresetSchema), auditLog('CropPreset'), cropPresetController.update);
router.delete('/crop-presets/:id', authenticate, authorizePermissions(PERMISSIONS.MEDIA_UPLOAD), validate(idParamSchema, 'params'), auditLog('CropPreset'), cropPresetController.remove);
router.post('/crop-presets/:id/restore', authenticate, authorizePermissions(PERMISSIONS.MEDIA_UPLOAD), validate(idParamSchema, 'params'), auditLog('CropPreset'), cropPresetController.restore);

router.post('/upload',
    authenticate,
    authorizePermissions(PERMISSIONS.MEDIA_UPLOAD),
    mediaUploadLimiter,
    memoryUpload.single('file'),
    auditLog('Media'),
    mediaController.upload
);

router.post('/upload-icon',
    authenticate,
    authorizePermissions(PERMISSIONS.MEDIA_UPLOAD),
    mediaUploadLimiter,
    memoryUpload.single('file'),
    auditLog('Media'),
    (req, res, next) => {
        req.body = req.body || {};
        req.body.type = 'icon';
        return mediaController.upload(req, res, next);
    }
);

router.post('/upload-font',
    authenticate,
    authorizePermissions(PERMISSIONS.MEDIA_UPLOAD),
    mediaUploadLimiter,
    fontUpload.single('file'),
    auditLog('Media'),
    mediaController.uploadFont
);

router.get('/',
    authenticate,
    authorizePermissions(PERMISSIONS.MEDIA_READ),
    validate(listMediaSchema, 'query'),
    mediaController.list
);

router.patch('/:id',
    authenticate,
    authorizePermissions(PERMISSIONS.MEDIA_UPDATE),
    validate(idParamSchema, 'params'),
    validate(updateMediaSchema),
    auditLog('Media'),
    mediaController.update
);

router.delete('/:id',
    authenticate,
    authorizePermissions(PERMISSIONS.MEDIA_DELETE),
    validate(idParamSchema, 'params'),
    auditLog('Media'),
    mediaController.delete
);

module.exports = router;
