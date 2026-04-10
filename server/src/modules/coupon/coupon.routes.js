'use strict';
const router = require('express').Router();
const couponController = require('./coupon.controller');
const { validate } = require('../../middleware/validate.middleware');
const { createCouponSchema, updateCouponSchema, validateCouponSchema } = require('./coupon.validation');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { auditLog } = require('../audit/audit.middleware');
const { couponLimiter } = require('../../middleware/rateLimiter.middleware');
const { featureGate } = require('../../middleware/featureGate.middleware');
const { PERMISSIONS } = require('../../config/permissions');

// Public: authenticated users can see available coupons (gated by showAvailableCoupons feature flag)
router.get('/public', authenticate, featureGate('showAvailableCoupons'), couponController.listPublic);

router.get('/', authenticate, authorizePermissions(PERMISSIONS.COUPONS_READ), couponController.list);
router.post('/', authenticate, authorizePermissions(PERMISSIONS.COUPONS_MANAGE), validate(createCouponSchema), auditLog('Coupon'), couponController.create);
router.get('/:id', authenticate, authorizePermissions(PERMISSIONS.COUPONS_READ), couponController.getOne);
router.put('/:id', authenticate, authorizePermissions(PERMISSIONS.COUPONS_MANAGE), validate(updateCouponSchema), auditLog('Coupon'), couponController.update);
router.delete('/:id', authenticate, authorizePermissions(PERMISSIONS.COUPONS_MANAGE), auditLog('Coupon'), couponController.remove);

router.post('/validate', authenticate, couponLimiter, validate(validateCouponSchema), couponController.validateCoupon);

module.exports = router;
