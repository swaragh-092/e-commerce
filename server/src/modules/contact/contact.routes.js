'use strict';

const router = require('express').Router();
const { createLimiter } = require('../../middleware/rateLimiter.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { contactSchema } = require('./contact.validation');
const controller = require('./contact.controller');

const contactLimiter = createLimiter(15, 5, 'Too many messages. Please try again after 15 minutes.', { prefix: 'contact-form' });

// Public contact form; separate from product enquiries and authenticated notification administration.
router.post('/', contactLimiter, validate(contactSchema), controller.submit);

module.exports = router;
