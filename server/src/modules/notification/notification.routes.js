'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions, authorizeAnyPermission } = require('../../middleware/role.middleware');
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

const { validate } = require('../../middleware/validate.middleware');
const assignmentParams = require('joi').object({ kind: require('joi').string().valid('orders', 'enquiries').required(), id: require('joi').string().uuid().required() });
router.get('/assignments/:kind/:id', validate(assignmentParams, 'params'), async (req, res, next) => {
  try { return require('../../utils/response').success(res, await require('./notificationAssignment.service').read(req.params.kind, req.params.id, req.user)); }
  catch (error) { next(error); }
});
router.put('/assignments/:kind/:id', validate(assignmentParams, 'params'), async (req, res, next) => {
  try { return require('../../utils/response').success(res, await require('./notificationAssignment.service').assign(req.params.kind, req.params.id, req.body.assignedUserId, req.user)); }
  catch (error) { next(error); }
});

router.get('/recipients', authorizePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE), async (req, res, next) => {
  try {
    const result = await require('./notificationRecipients.service').read();
    return require('../../utils/response').success(res, result);
  } catch (err) { next(err); }
});
router.put('/recipients', authorizePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE), async (req, res, next) => {
  try {
    const result = await require('./notificationRecipients.service').update(req.body, req.user);
    return require('../../utils/response').success(res, result, 'Email recipients saved');
  } catch (err) { next(err); }
});

// Template READ — settings.read is enough (admins can view)
router.get(
  '/templates',
  authorizeAnyPermission(PERMISSIONS.SETTINGS_READ, PERMISSIONS.NOTIFICATIONS_MANAGE),
  listTemplates
);
router.get(
  '/templates/:name',
  authorizeAnyPermission(PERMISSIONS.SETTINGS_READ, PERMISSIONS.NOTIFICATIONS_MANAGE),
  getTemplate
);
router.get(
  '/templates/:name/default',
  authorizeAnyPermission(PERMISSIONS.SETTINGS_READ, PERMISSIONS.NOTIFICATIONS_MANAGE),
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
  authorizeAnyPermission(PERMISSIONS.SETTINGS_READ, PERMISSIONS.NOTIFICATIONS_MANAGE),
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
