'use strict';
const Joi = require('joi');

const createOrderSchema = Joi.object({
    orderId: Joi.string().uuid().required()
});

module.exports = { createOrderSchema };
