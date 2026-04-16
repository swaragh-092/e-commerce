'use strict';

const Joi = require('joi');
const { ROLES } = require('../../config/constants');

const updateUserRoleSchema = Joi.object({
  roleId: Joi.string().uuid().required(),
});

const rolePayload = {
  name: Joi.string().max(100).required(),
  description: Joi.string().max(255).allow('', null),
  baseRole: Joi.string()
    .valid(ROLES.CUSTOMER, ROLES.ADMIN)
    .required(),
  permissionIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
};

const createRoleSchema = Joi.object(rolePayload);

const updateRoleSchema = Joi.object({
  name: Joi.string().max(100).optional(),
  description: Joi.string().max(255).allow('', null).optional(),
  baseRole: Joi.string()
    .valid(ROLES.CUSTOMER, ROLES.ADMIN)
    .optional(),
  permissionIds: Joi.array().items(Joi.string().uuid()).min(1).optional(),
});

const salesChartQuerySchema = Joi.object({
  period: Joi.string()
    .valid('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'mtd', 'ytd', 'custom')
    .default('monthly'),
  startDate: Joi.when('period', {
    is: 'custom',
    then: Joi.date().iso().required(),
    otherwise: Joi.forbidden(),
  }),
  endDate: Joi.when('period', {
    is: 'custom',
    then: Joi.date().iso().min(Joi.ref('startDate')).required(),
    otherwise: Joi.forbidden(),
  }),
});

module.exports = {
  updateUserRoleSchema,
  createRoleSchema,
  updateRoleSchema,
  salesChartQuerySchema,
};