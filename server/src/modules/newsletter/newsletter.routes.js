'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const controller = require('./newsletter.controller');
const rateLimit = require('express-rate-limit');
const { validate } = require('../../middleware/validate.middleware');
const { idParamSchema } = require('../../utils/common.validation');

const subscribeLimiter = rateLimit({ windowMs: 60000, max: 5, message: { success: false, message: 'Too many subscribe attempts. Try again later.' } });
const unsubscribeLimiter = rateLimit({ windowMs: 60000, max: 3, message: { success: false, message: 'Too many unsubscribe attempts. Try again later.' } });

// Public
router.post('/subscribe', subscribeLimiter, controller.subscribe);
router.post('/unsubscribe', unsubscribeLimiter, controller.unsubscribe);
router.get('/unsubscribe/:token', controller.unsubscribeByToken);

// Customer preference (the authenticated account email is always used).
router.get('/me', authenticate, controller.getMyStatus);
router.put('/me', authenticate, controller.updateMyStatus);

const campaigns = require('./newsletterCampaign.service');
const { success } = require('../../utils/response');
const handleCampaign = (handler) => async (req, res, next) => {
  try { return success(res, await handler(req)); } catch (error) { next(error); }
};
router.get('/campaigns', authenticate, authorizePermissions(PERMISSIONS.SETTINGS_READ), handleCampaign(() => campaigns.list()));
router.post('/campaigns', authenticate, authorizePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE), handleCampaign((req) => campaigns.create(req.body, req.user.id)));
router.post('/campaigns/test', authenticate, authorizePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE), handleCampaign((req) => campaigns.test(req.body, req.user)));
router.put('/campaigns/:id', authenticate, authorizePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE), validate(idParamSchema, 'params'), handleCampaign((req) => campaigns.edit(req.params.id, req.body)));
router.post('/campaigns/:id/schedule', authenticate, authorizePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE), validate(idParamSchema, 'params'), handleCampaign((req) => campaigns.schedule(req.params.id, req.body.scheduledAt)));
router.post('/campaigns/:id/cancel', authenticate, authorizePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE), validate(idParamSchema, 'params'), handleCampaign((req) => campaigns.cancel(req.params.id)));

// Admin
router.get('/', authenticate, authorizePermissions(PERMISSIONS.SETTINGS_READ), controller.list);

module.exports = router;
