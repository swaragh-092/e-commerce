'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizeAnyPermission, authorizePermissions } = require('../../middleware/role.middleware');
const adminController = require('./admin.controller');
const { PERMISSIONS } = require('../../config/permissions');
const { validate } = require('../../middleware/validate.middleware');
const { updateUserRoleSchema, createRoleSchema, updateRoleSchema, salesChartQuerySchema, lowStockQuerySchema, createStaffUserSchema } = require('./admin.validation');

const adminOnly = [authenticate, authorizePermissions(PERMISSIONS.DASHBOARD_VIEW)];
const accessReadOnly = [
	authenticate,
	authorizeAnyPermission(
		PERMISSIONS.ROLES_READ,
		PERMISSIONS.ROLES_MANAGE,
		PERMISSIONS.SYSTEM_ROLES_MANAGE,
		PERMISSIONS.USERS_ASSIGN_ROLES
	),
];
const roleManageOnly = [authenticate, authorizePermissions(PERMISSIONS.ROLES_MANAGE)];
const roleEditOnly = [authenticate, authorizeAnyPermission(PERMISSIONS.ROLES_MANAGE, PERMISSIONS.SYSTEM_ROLES_MANAGE)];
const accessManageOnly = [authenticate, authorizePermissions(PERMISSIONS.USERS_ASSIGN_ROLES)];

router.get('/dashboard/stats', ...adminOnly, adminController.getStats);
router.get(
	'/dashboard/sales-chart',
	...adminOnly,
	validate(salesChartQuerySchema, 'query'),
	adminController.getSalesChart
);
router.get('/dashboard/low-stock', ...adminOnly, validate(lowStockQuerySchema, 'query'), adminController.getLowStock);
router.get('/dashboard/recent-orders', ...adminOnly, adminController.getRecentOrders);
router.get('/access-control/roles', ...accessReadOnly, adminController.getAccessRoles);
router.get('/access-control/permissions', ...accessReadOnly, adminController.getAccessPermissions);
router.post('/access-control/roles', ...roleManageOnly, validate(createRoleSchema), adminController.createAccessRole);
router.put('/access-control/roles/:id', ...roleEditOnly, validate(updateRoleSchema), adminController.updateAccessRole);
router.get('/access-control/users', ...accessManageOnly, adminController.getAccessUsers);
router.post('/access-control/users', ...accessManageOnly, validate(createStaffUserSchema), adminController.createStaffUser);
router.put('/access-control/users/:id/role', ...accessManageOnly, validate(updateUserRoleSchema), adminController.updateUserRole);

module.exports = router;
