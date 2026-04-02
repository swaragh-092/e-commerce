'use strict';
const router = require('express').Router();
const couponController = require('./coupon.controller');
const { validate } = require('../../middleware/validate.middleware');
const { createCouponSchema, updateCouponSchema, validateCouponSchema } = require('./coupon.validation');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');
const { auditLog } = require('../audit/audit.middleware');
const rateLimit = require('express-rate-limit');

// 10 requests per minute
const couponLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many attempts. Try again in 1 minute.' } }
});

router.get('/', authenticate, authorize('admin', 'super_admin'), couponController.list);
router.post('/', authenticate, authorize('admin', 'super_admin'), validate(createCouponSchema), auditLog('Coupon'), couponController.create);
router.get('/:id', authenticate, authorize('admin', 'super_admin'), couponController.getOne);
router.put('/:id', authenticate, authorize('admin', 'super_admin'), validate(updateCouponSchema), auditLog('Coupon'), couponController.update);
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), auditLog('Coupon'), couponController.remove);

router.post('/validate', authenticate, couponLimiter, validate(validateCouponSchema), couponController.validateCoupon);

module.exports = router;
