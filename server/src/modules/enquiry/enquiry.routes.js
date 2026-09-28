'use strict';

const express = require('express');
const router = express.Router();
const enquiryController = require('./enquiry.controller');
const { validate } = require('../../middleware/validate.middleware');
const { createEnquirySchema } = require('./enquiry.validation');
const { featureGate } = require('../../middleware/featureGate.middleware');

// Public route for customers to submit enquiries
router.post('/', featureGate('enquiry'), validate(createEnquirySchema), enquiryController.createEnquiry);

module.exports = router;
