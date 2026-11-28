'use strict';

const express = require('express');
const router = express.Router();
const enquiryController = require('./enquiry.controller');
const { validate } = require('../../middleware/validate.middleware');
const { createEnquirySchema } = require('./enquiry.validation');
const { featureGate, getResolvedFeature } = require('../../middleware/featureGate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { verifySessionCsrf } = require('../../middleware/csrf.middleware');
const { getAccessToken } = require('../auth/authCookies');

const identifySubmitter = async (req, res, next) => {
  try {
    const loginRequired = await getResolvedFeature('requireLoginForEnquiry');
    if (!loginRequired && !getAccessToken(req)) return next();

    return authenticate(req, res, (error) => {
      if (error) {
        if (!loginRequired && [401, 403].includes(error.statusCode)) return next();
        return next(error);
      }
      // A verified browser session also needs CSRF protection before it can be linked.
      return verifySessionCsrf(req, res, (csrfError) => {
        if (csrfError && !loginRequired && csrfError.code === 'CSRF_TOKEN_INVALID') {
          delete req.user;
          return next();
        }
        return next(csrfError);
      });
    });
  } catch (error) {
    return next(error);
  }
};

router.post('/', featureGate('enquiry'), identifySubmitter, validate(createEnquirySchema), enquiryController.createEnquiry);

module.exports = router;
