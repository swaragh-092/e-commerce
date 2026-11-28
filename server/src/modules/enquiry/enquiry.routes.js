'use strict';

const express = require('express');
const router = express.Router();
const enquiryController = require('./enquiry.controller');
const { validate } = require('../../middleware/validate.middleware');
const { createEnquirySchema } = require('./enquiry.validation');
const { featureGate, getResolvedFeature } = require('../../middleware/featureGate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');

const requireLoginIfEnabled = async (req, res, next) => {
  try {
    if (await getResolvedFeature('requireLoginForEnquiry')) {
      return authenticate(req, res, next);
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

router.post('/', featureGate('enquiry'), requireLoginIfEnabled, validate(createEnquirySchema), enquiryController.createEnquiry);

module.exports = router;
