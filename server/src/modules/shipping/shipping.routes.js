'use strict';

const router = require('express').Router();
const { optionalAuth } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validate.middleware');
const shippingController = require('./shipping.controller');
const { calculateShippingSchema } = require('./shipping.validation');

const { featureGate } = require('../../middleware/featureGate.middleware');

router.use(featureGate('shipping'));

router.post('/calculate', optionalAuth, validate(calculateShippingSchema), shippingController.calculate);
router.post('/check-serviceability', optionalAuth, validate(calculateShippingSchema), shippingController.calculate);

module.exports = router;
