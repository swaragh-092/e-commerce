'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { featureGate } = require('../../middleware/featureGate.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const controller = require('./newsletter.controller');
const rateLimit = require('express-rate-limit');
const { validate } = require('../../middleware/validate.middleware');
const { idParamSchema } = require('../../utils/common.validation');

const limiter = (max, message) => rateLimit({
  windowMs: 60000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message } },
});
const subscribeLimiter = limiter(5, 'Too many subscribe attempts. Try again later.');
const unsubscribeLimiter = limiter(3, 'Too many unsubscribe attempts. Try again later.');
const confirmLimiter = limiter(5, 'Too many confirmation attempts. Try again later.');

// Public
router.post('/subscribe', featureGate('newsletter'), subscribeLimiter, controller.subscribe);
router.post('/unsubscribe', unsubscribeLimiter, controller.unsubscribe);
// RFC 8058 one-click endpoint (token in query string; state changes via POST only)
router.post('/unsubscribe/one-click', unsubscribeLimiter, controller.unsubscribeOneClick);
router.post('/confirm', confirmLimiter, controller.confirm);

// Customer preference (the authenticated account email is always used).
router.get('/me', authenticate, controller.getMyStatus);
router.put('/me', authenticate, controller.updateMyStatus);

const campaigns = require('./newsletterCampaign.service');
const { success } = require('../../utils/response');
const handleCampaign = (handler) => async (req, res, next) => {
  try { return success(res, await handler(req)); } catch (error) { next(error); }
};
router.get('/campaigns', authenticate, authorizePermissions(PERMISSIONS.NEWSLETTER_READ), handleCampaign(() => campaigns.list()));
router.post('/campaigns', authenticate, authorizePermissions(PERMISSIONS.NEWSLETTER_MANAGE), featureGate('newsletter'), handleCampaign((req) => campaigns.create(req.body, req.user.id)));
router.post('/campaigns/test', authenticate, authorizePermissions(PERMISSIONS.NEWSLETTER_MANAGE), featureGate('newsletter'), handleCampaign((req) => campaigns.test(req.body, req.user)));
router.put('/campaigns/:id', authenticate, authorizePermissions(PERMISSIONS.NEWSLETTER_MANAGE), featureGate('newsletter'), validate(idParamSchema, 'params'), handleCampaign((req) => campaigns.edit(req.params.id, req.body)));
router.post('/campaigns/:id/schedule', authenticate, authorizePermissions(PERMISSIONS.NEWSLETTER_MANAGE), featureGate('newsletter'), validate(idParamSchema, 'params'), handleCampaign((req) => campaigns.schedule(req.params.id, req.body.scheduledAt)));
router.post('/campaigns/:id/cancel', authenticate, authorizePermissions(PERMISSIONS.NEWSLETTER_MANAGE), validate(idParamSchema, 'params'), handleCampaign((req) => campaigns.cancel(req.params.id)));

// Admin
router.get('/', authenticate, authorizePermissions(PERMISSIONS.NEWSLETTER_SUBSCRIBERS_READ), controller.list);

module.exports = router;
