'use strict';
const express = require('express');
const router = express.Router();
const mediaController = require('./media.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { auditLog } = require('../audit/audit.middleware');
const multer = require('multer');
const { PERMISSIONS } = require('../../config/permissions');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/upload',
    authenticate,
    authorizePermissions(PERMISSIONS.MEDIA_UPLOAD),
    upload.single('file'),
    auditLog('Media'),
    mediaController.upload
);

router.get('/',
    authenticate,
    authorizePermissions(PERMISSIONS.MEDIA_READ),
    mediaController.list
);

router.delete('/:id',
    authenticate,
    authorizePermissions(PERMISSIONS.MEDIA_DELETE),
    auditLog('Media'),
    mediaController.delete
);

module.exports = router;
