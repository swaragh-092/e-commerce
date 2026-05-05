'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validate.middleware');
const shippingController = require('./shipping.controller');
const { calculateShippingSchema } = require('./shipping.validation');

const { featureGate } = require('../../middleware/featureGate.middleware');

router.use(featureGate('shipping'));

router.post('/calculate', authenticate, validate(calculateShippingSchema), shippingController.calculate);
router.post('/check-serviceability', authenticate, validate(calculateShippingSchema), shippingController.calculate);

module.exports = router;
