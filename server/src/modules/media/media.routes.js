'use strict';
const express = require('express');
const router = express.Router();
const mediaController = require('./media.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');
const { auditLog } = require('../audit/audit.middleware');
const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/upload',
    authenticate,
    authorize('admin', 'super_admin'),
    upload.single('file'),
    auditLog('Media'),
    mediaController.upload
);

router.get('/',
    authenticate,
    authorize('admin', 'super_admin'),
    mediaController.list
);

router.delete('/:id',
    authenticate,
    authorize('admin', 'super_admin'),
    auditLog('Media'),
    mediaController.delete
);

module.exports = router;
