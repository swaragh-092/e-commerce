'use strict';
const router = require('express').Router();
const couponController = require('./coupon.controller');
const { validate } = require('../../middleware/validate.middleware');
const { createCouponSchema, updateCouponSchema, validateCouponSchema, eligibleCouponsSchema } = require('./coupon.validation');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { auditLog } = require('../audit/audit.middleware');
const { couponLimiter } = require('../../middleware/rateLimiter.middleware');
const { featureGate } = require('../../middleware/featureGate.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const { idParamSchema, paginationQuerySchema } = require('../../utils/common.validation');



// Public / Customer routes: gated by 'coupons' (and 'showAvailableCoupons' where applicable)
router.get('/public', authenticate, featureGate('coupons'), featureGate('showAvailableCoupons'), couponController.listPublic);
router.post('/eligible', authenticate, featureGate('coupons'), featureGate('showAvailableCoupons'), validate(eligibleCouponsSchema), couponController.getEligibleCoupons);

// Admin routes: staff can view and manage existing coupons regardless of feature flag state
router.get('/', authenticate, authorizePermissions(PERMISSIONS.COUPONS_READ), validate(paginationQuerySchema, 'query'), couponController.list);

router.post('/', authenticate, authorizePermissions(PERMISSIONS.COUPONS_MANAGE), validate(createCouponSchema), auditLog('Coupon'), couponController.create);
router.get('/:id', authenticate, authorizePermissions(PERMISSIONS.COUPONS_READ), validate(idParamSchema, 'params'), couponController.getOne);
router.put('/:id', authenticate, authorizePermissions(PERMISSIONS.COUPONS_MANAGE), validate(idParamSchema, 'params'), validate(updateCouponSchema), auditLog('Coupon'), couponController.update);
router.delete('/:id', authenticate, authorizePermissions(PERMISSIONS.COUPONS_MANAGE), validate(idParamSchema, 'params'), auditLog('Coupon'), couponController.remove);

// Validate coupon: customer action to check coupon code
router.post('/validate', featureGate('coupons'), optionalAuth, couponLimiter, validate(validateCouponSchema), couponController.validateCoupon);

module.exports = router;
