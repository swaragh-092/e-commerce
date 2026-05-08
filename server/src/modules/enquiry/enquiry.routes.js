'use strict';

const express = require('express');
const router = express.Router();
const enquiryController = require('./enquiry.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { PERMISSIONS } = require('../../config/permissions');

const { featureGate } = require('../../middleware/featureGate.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { createEnquirySchema, updateEnquiryStatusSchema, replyEnquirySchema } = require('./enquiry.validation');
const { idParamSchema } = require('../../utils/common.validation');


// Apply enquiry feature gate to all routes in this module
router.use(featureGate('enquiry'));

// Public route for customers to submit enquiries
router.post('/', validate(createEnquirySchema), enquiryController.createEnquiry);

// Admin routes for managing enquiries
router.get(
  '/admin',
  authenticate,
  authorizePermissions(PERMISSIONS.ENQUIRIES_READ),
  enquiryController.getEnquiries
);

router.patch(
  '/admin/:id/status',
  authenticate,
  authorizePermissions(PERMISSIONS.ENQUIRIES_MANAGE),
  validate(idParamSchema, 'params'),
  validate(updateEnquiryStatusSchema),
  enquiryController.updateStatus

);

router.post(
  '/admin/:id/reply',
  authenticate,
  authorizePermissions(PERMISSIONS.ENQUIRIES_MANAGE),
  validate(idParamSchema, 'params'),
  validate(replyEnquirySchema),
  enquiryController.replyEnquiry

);

module.exports = router;
