'use strict';

const Joi = require('joi');

const saleLabelBodySchema = Joi.object({
  name:     Joi.string().trim().max(80).required(),
  color:    Joi.string().pattern(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/).default('#EF4444'),
  priority: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true),
});

const updateSaleLabelBodySchema = Joi.object({
  name:     Joi.string().trim().max(80),
  color:    Joi.string().pattern(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/),
  priority: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
}).min(1);

/**
 * Full catalog replace — expects an array of label objects.
 * Each item may include an optional "id" (slug); if omitted it is derived from "name".
 */
const replaceSaleLabelsBodySchema = Joi.array().items(
  Joi.object({
    id:       Joi.string().max(80).lowercase().allow('', null),
    name:     Joi.string().trim().max(80).required(),
    color:    Joi.string().pattern(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/).default('#EF4444'),
    priority: Joi.number().integer().min(0).default(0),
    isActive: Joi.boolean().default(true),
  })
).min(0);

module.exports = {
  saleLabelBodySchema,
  updateSaleLabelBodySchema,
  replaceSaleLabelsBodySchema,
};
