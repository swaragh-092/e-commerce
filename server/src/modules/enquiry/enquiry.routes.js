'use strict';

const express = require('express');
const router = express.Router();
const enquiryController = require('./enquiry.controller');
const { featureGate } = require('../../middleware/featureGate.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { createEnquirySchema } = require('./enquiry.validation');

// Apply enquiry feature gate to all routes in this module
router.use(featureGate('enquiry'));

// Public route for customers to submit enquiries
router.post('/', validate(createEnquirySchema), enquiryController.createEnquiry);

module.exports = router;
