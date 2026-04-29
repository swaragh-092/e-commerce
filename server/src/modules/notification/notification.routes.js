'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const {
  listTemplates,
  getTemplate,
  updateTemplate,
  previewTemplate,
  resetTemplate,
  getDefaultTemplate,
  sendTestNotification,
} = require('./notification.controller');

// All notification endpoints require authentication
router.use(authenticate);

// Template READ — settings.read is enough (admins can view)
router.get(
  '/templates',
  authorizePermissions(PERMISSIONS.SETTINGS_READ),
  listTemplates
);
router.get(
  '/templates/:name',
  authorizePermissions(PERMISSIONS.SETTINGS_READ),
  getTemplate
);
router.get(
  '/templates/:name/default',
  authorizePermissions(PERMISSIONS.SETTINGS_READ),
  getDefaultTemplate
);

// Template WRITE — require notifications.manage
router.put(
  '/templates/:name',
  authorizePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE),
  updateTemplate
);
router.post(
  '/templates/:name/preview',
  authorizePermissions(PERMISSIONS.SETTINGS_READ),
  previewTemplate
);
router.post(
  '/templates/:name/reset',
  authorizePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE),
  resetTemplate
);

// Test send — require notifications.manage
router.post('/test', authorizePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE), sendTestNotification);

// Backward-compatible alias
router.post('/templates/test', authorizePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE), sendTestNotification);

module.exports = router;
