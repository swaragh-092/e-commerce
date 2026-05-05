'use strict';

const express = require('express');
const router = express.Router();
const enquiryController = require('./enquiry.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { PERMISSIONS } = require('../../config/permissions');

const { featureGate } = require('../../middleware/featureGate.middleware');

router.use(featureGate('enquiry'));

// Public route for customers to submit enquiries
router.post('/', enquiryController.createEnquiry);

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
  enquiryController.updateStatus
);

router.post(
  '/admin/:id/reply',
  authenticate,
  authorizePermissions(PERMISSIONS.ENQUIRIES_MANAGE),
  enquiryController.replyEnquiry
);

module.exports = router;
