'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');
const auditController = require('./audit.controller');

// Admin-only: list audit logs with filters
router.get('/', authenticate, authorize('admin', 'super_admin'), auditController.getAll);

module.exports = router;
