'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const controller = require('./newsletter.controller');
const rateLimit = require('express-rate-limit');

const subscribeLimiter = rateLimit({ windowMs: 60000, max: 5, message: { success: false, message: 'Too many subscribe attempts. Try again later.' } });
const unsubscribeLimiter = rateLimit({ windowMs: 60000, max: 3, message: { success: false, message: 'Too many unsubscribe attempts. Try again later.' } });

// Public
router.post('/subscribe', subscribeLimiter, controller.subscribe);
router.post('/unsubscribe', unsubscribeLimiter, controller.unsubscribe);
router.get('/unsubscribe/:token', controller.unsubscribeByToken);

// Admin
router.get('/', authenticate, authorizePermissions(PERMISSIONS.SETTINGS_READ), controller.list);

module.exports = router;
