'use strict';

const service = require('./contact.service');
const { success } = require('../../utils/response');

const submit = async (req, res, next) => {
  try {
    const result = await service.submit(req.validated);
    return success(res, result, 'Thank you. Your message has been received. Our team will get back to you.', 202);
  } catch (error) {
    next(error);
  }
};

module.exports = { submit };
