'use strict';
const Joi = require('joi');

const createIntentSchema = Joi.object({
    orderId: Joi.string().uuid().required()
});

module.exports = { createIntentSchema };
