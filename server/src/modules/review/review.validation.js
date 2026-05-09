'use strict';

const Joi = require('joi');

const createReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  title: Joi.string().max(255).allow(null, ''),
  body: Joi.string().max(5000).allow(null, ''),
  orderId: Joi.string().uuid().optional().allow(null)
}).or('title', 'body');

const moderateReviewSchema = Joi.object({
  status: Joi.string().valid('pending', 'approved', 'rejected').required()
});

module.exports = {
  createReviewSchema,
  moderateReviewSchema
};
