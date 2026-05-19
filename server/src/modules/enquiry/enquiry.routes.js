'use strict';

const express = require('express');
const router = express.Router();
const enquiryController = require('./enquiry.controller');
const { validate } = require('../../middleware/validate.middleware');
const { createEnquirySchema } = require('./enquiry.validation');

// Public route for customers to submit enquiries
router.post('/', validate(createEnquirySchema), enquiryController.createEnquiry);

module.exports = router;
