'use strict';
const express = require('express');
const router = express.Router();
const mediaController = require('./media.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { auditLog } = require('../audit/audit.middleware');
const { memoryUpload } = require('../../middleware/upload.middleware');
const { mediaUploadLimiter } = require('../../middleware/rateLimiter.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const { validate } = require('../../middleware/validate.middleware');
const { idParamSchema } = require('../../utils/common.validation');
const { updateMediaSchema, listMediaSchema } = require('./media.validation');

router.post('/upload',
    authenticate,
    authorizePermissions(PERMISSIONS.MEDIA_UPLOAD),
    mediaUploadLimiter,
    memoryUpload.single('file'),
    auditLog('Media'),
    mediaController.upload
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
