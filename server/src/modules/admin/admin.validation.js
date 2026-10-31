'use strict';

const Joi = require('joi');
const { ROLES } = require('../../config/constants');

const updateUserRoleSchema = Joi.object({
  roleId: Joi.string().uuid().required(),
});

const updateStaffStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive').required(),
  reason: Joi.string().trim().min(5).max(500).required(),
});

const accessUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(1000).default(20),
  search: Joi.string().trim().max(200).allow(''),
  roleId: Joi.string().uuid().allow(''),
  status: Joi.string().valid('active', 'inactive', 'banned').allow(''),
  includeCustomers: Joi.boolean().default(false),
});

const rolePayload = {
  name: Joi.string().max(100).required(),
  description: Joi.string().max(255).allow('', null),
  baseRole: Joi.string()
    .valid(ROLES.CUSTOMER, ROLES.ADMIN)
    .required(),
  permissionIds: Joi.array().items(Joi.string().uuid()).default([]).required(),
};

const createRoleSchema = Joi.object(rolePayload);

const deleteRoleSchema = Joi.object({
  replacementRoleId: Joi.string().uuid().allow(null).optional(),
});

const updateRoleSchema = Joi.object({
  name: Joi.string().max(100).optional(),
  description: Joi.string().max(255).allow('', null).optional(),
  baseRole: Joi.string()
    .valid(ROLES.CUSTOMER, ROLES.ADMIN)
    .optional(),
  permissionIds: Joi.array().items(Joi.string().uuid()).optional(),
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

const lowStockQuerySchema = Joi.object({
  threshold: Joi.number().integer().min(1).default(10).optional(),
});

const createStaffUserSchema = Joi.object({
  sendInvitation: Joi.boolean().default(false),
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().min(1).max(100).required(),
  email: Joi.string().email({ tlds: { allow: false } }).required().lowercase().trim(),
  password: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])'))
    .message('Password must be at least 8 characters long and include uppercase, lowercase, number, and special character (!@#$%^&*)')
    .when('sendInvitation', { is: true, then: Joi.optional(), otherwise: Joi.required() }),
  roleId: Joi.string().uuid().required(),
});

const analyticsQuerySchema = Joi.object({
  period: Joi.string().pattern(/^\d+(d|m)$/).default('30d'),
  limit: Joi.number().integer().min(1).max(50).default(10),
  sortBy: Joi.string().valid('quantity', 'revenue').default('quantity'),
  compare: Joi.boolean().default(false),
});

const catalogAnalyticsQuerySchema = Joi.object({
  period: Joi.string().valid('7d', '30d', '90d', '12m').default('30d'),
});

const analyticsTrendSchema = Joi.object({
  period: Joi.string().valid('daily', 'weekly', 'monthly').default('monthly'),
});

module.exports = {
  updateUserRoleSchema,
  updateStaffStatusSchema,
  accessUsersQuerySchema,
  createRoleSchema,
  updateRoleSchema,
  deleteRoleSchema,
  salesChartQuerySchema,
  lowStockQuerySchema,
  createStaffUserSchema,
  analyticsQuerySchema,
  catalogAnalyticsQuerySchema,
  analyticsTrendSchema,
};
