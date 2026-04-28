'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const {
  listTemplates,
  getTemplate,
  updateTemplate,
  sendTestNotification,
} = require('./notification.controller');

// All notification endpoints require auth + settings manage permission
router.use(authenticate, authorizePermissions(PERMISSIONS.SETTINGS_MANAGE));

// Template CRUD
router.get('/templates',         listTemplates);
router.get('/templates/:name',   getTemplate);
router.put('/templates/:name',   updateTemplate);

// Multi-channel test send (replaces /templates/test)
// POST body: { templateName, recipient, channel }
router.post('/test', sendTestNotification);

// Backward-compatible alias — old clients calling /templates/test still work
router.post('/templates/test', sendTestNotification);

module.exports = router;
