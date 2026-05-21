'use strict';

const router = require('express').Router();
const enquiryController = require('./enquiry.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const { featureGate } = require('../../middleware/featureGate.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { updateEnquiryStatusSchema, replyEnquirySchema, queryEnquiriesSchema } = require('./enquiry.validation');
const { idParamSchema } = require('../../utils/common.validation');

// Apply enquiry feature gate to all routes in this module
router.use(featureGate('enquiry'));

// Admin routes for managing enquiries
router.get(
  '/',
  authenticate,
  authorizePermissions(PERMISSIONS.ENQUIRIES_READ),
  validate(queryEnquiriesSchema, 'query'),
  enquiryController.getEnquiries
);

router.patch(
  '/:id/status',
  authenticate,
  authorizePermissions(PERMISSIONS.ENQUIRIES_MANAGE),
  validate(idParamSchema, 'params'),
  validate(updateEnquiryStatusSchema),
  enquiryController.updateStatus
);

router.post(
  '/:id/reply',
  authenticate,
  authorizePermissions(PERMISSIONS.ENQUIRIES_MANAGE),
  validate(idParamSchema, 'params'),
  validate(replyEnquirySchema),
  enquiryController.replyEnquiry
);

module.exports = router;
