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

module.exports = {
  updateUserRoleSchema,
  createRoleSchema,
  updateRoleSchema,
};