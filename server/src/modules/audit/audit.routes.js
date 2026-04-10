'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const auditController = require('./audit.controller');
const { PERMISSIONS } = require('../../config/permissions');

// Admin-only: list audit logs with filters
router.get('/', authenticate, authorizePermissions(PERMISSIONS.AUDIT_READ), auditController.getAll);

module.exports = router;
