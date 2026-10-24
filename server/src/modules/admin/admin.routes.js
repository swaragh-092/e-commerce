'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizeAnyPermission, authorizePermissions } = require('../../middleware/role.middleware');
const adminController = require('./admin.controller');
const { PERMISSIONS } = require('../../config/permissions');
const { validate } = require('../../middleware/validate.middleware');
const { updateUserRoleSchema, createRoleSchema, updateRoleSchema, salesChartQuerySchema, lowStockQuerySchema, createStaffUserSchema, analyticsQuerySchema, analyticsTrendSchema } = require('./admin.validation');
const { idParamSchema, paginationQuerySchema } = require('../../utils/common.validation');
const { inventoryAlertConfigSchema, updateInventoryAlertSchema } = require('../inventory/inventoryAlert.validation');



const { inventoryAlertLimiter, inventoryAlertTestLimiter } = require('../../middleware/rateLimiter.middleware');
const { featureGate } = require('../../middleware/featureGate.middleware');

const adminOnly = [authenticate, authorizePermissions(PERMISSIONS.DASHBOARD_VIEW)];
const analyticsOnly = [authenticate, authorizePermissions(PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.ORDERS_READ)];
const customerAnalyticsOnly = [authenticate, authorizePermissions(PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.ORDERS_READ, PERMISSIONS.CUSTOMERS_READ)];
const ordersFeature = featureGate('orders');
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
	authorizePermissions(PERMISSIONS.ORDERS_READ),
	ordersFeature,
	validate(salesChartQuerySchema, 'query'),
	adminController.getSalesChart
);
router.get(
	'/dashboard/inventory-alerts',
	inventoryAlertLimiter,
	authenticate,
	authorizePermissions(PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.PRODUCTS_READ),
	adminController.getInventoryAlerts
);
router.patch(
	'/dashboard/inventory-alerts/:id',
	inventoryAlertLimiter,
	authenticate,
	authorizePermissions(PERMISSIONS.PRODUCTS_UPDATE),
	validate(idParamSchema, 'params'),
	validate(updateInventoryAlertSchema),
	adminController.updateInventoryAlert
);
router.get(
	'/inventory-alerts/config',
	inventoryAlertLimiter,
	authenticate,
	authorizePermissions(PERMISSIONS.SETTINGS_READ),
	adminController.getInventoryAlertConfig
);
router.put(
	'/inventory-alerts/config',
	inventoryAlertLimiter,
	authenticate,
	authorizePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE),
	validate(inventoryAlertConfigSchema),
	adminController.saveInventoryAlertConfig
);
router.post(
	'/inventory-alerts/test',
	inventoryAlertTestLimiter,
	authenticate,
	authorizePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE),
	adminController.testInventoryAlertEmail
);
router.get('/dashboard/low-stock', authenticate, authorizePermissions(PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.PRODUCTS_READ), validate(lowStockQuerySchema, 'query'), adminController.getLowStock);
router.get('/dashboard/recent-orders', authenticate, authorizePermissions(PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.ORDERS_READ), ordersFeature, adminController.getRecentOrders);
router.get('/access-control/roles', ...accessReadOnly, adminController.getAccessRoles);
router.get('/access-control/permissions', ...accessReadOnly, adminController.getAccessPermissions);
router.post('/access-control/roles', ...roleManageOnly, validate(createRoleSchema), adminController.createAccessRole);
router.put('/access-control/roles/:id', ...roleEditOnly, validate(idParamSchema, 'params'), validate(updateRoleSchema), adminController.updateAccessRole);
router.delete('/access-control/roles/:id', ...roleManageOnly, validate(idParamSchema, 'params'), adminController.deleteAccessRole);

router.get('/access-control/users', ...accessManageOnly, validate(paginationQuerySchema, 'query'), adminController.getAccessUsers);

router.post('/access-control/users', ...accessManageOnly, validate(createStaffUserSchema), adminController.createStaffUser);
router.put('/access-control/users/:id/role', ...accessManageOnly, validate(idParamSchema, 'params'), validate(updateUserRoleSchema), adminController.updateUserRole);
router.delete('/access-control/users/:id', ...accessManageOnly, validate(idParamSchema, 'params'), adminController.deleteStaffUser);

// Analytics
router.get('/analytics/top-products', ...analyticsOnly, validate(analyticsQuerySchema, 'query'), adminController.getTopProducts);
router.get('/analytics/aov-trend', ...analyticsOnly, ordersFeature, validate(analyticsTrendSchema, 'query'), adminController.getAovTrend);
router.get('/analytics/abandoned-carts', ...analyticsOnly, ordersFeature, validate(analyticsQuerySchema, 'query'), adminController.getAbandonedCarts);
router.get('/analytics/revenue-by-category', ...analyticsOnly, ordersFeature, validate(analyticsQuerySchema, 'query'), adminController.getRevenueByCategory);
router.get('/analytics/repeat-customers', ...analyticsOnly, ordersFeature, validate(analyticsQuerySchema, 'query'), adminController.getRepeatCustomers);
router.get('/analytics/refund-rate', ...analyticsOnly, ordersFeature, validate(analyticsTrendSchema, 'query'), adminController.getRefundRate);
router.get('/analytics/geographic-sales', ...analyticsOnly, ordersFeature, validate(analyticsQuerySchema, 'query'), adminController.getGeographicSales);
router.get('/analytics/revenue-by-payment', ...analyticsOnly, ordersFeature, validate(analyticsQuerySchema, 'query'), adminController.getRevenueByPaymentMethod);
router.get('/analytics/customer-lifetime-value', ...customerAnalyticsOnly, ordersFeature, validate(analyticsQuerySchema, 'query'), adminController.getCustomerLifetimeValue);
router.get('/analytics/conversion-rate', ...analyticsOnly, ordersFeature, validate(analyticsQuerySchema, 'query'), adminController.getConversionRate);
router.get('/analytics/traffic-sources', ...analyticsOnly, validate(analyticsQuerySchema, 'query'), adminController.getTrafficSources);
router.get('/analytics/product-funnel', ...analyticsOnly, validate(analyticsQuerySchema, 'query'), adminController.getProductFunnel);
router.get('/analytics/utm-attribution', ...analyticsOnly, validate(analyticsQuerySchema, 'query'), adminController.getUtmAttribution);
router.get('/analytics/coupon-performance', ...analyticsOnly, ordersFeature, featureGate('coupons'), validate(analyticsQuerySchema, 'query'), adminController.getCouponPerformance);
router.get('/analytics/cohort-retention', ...analyticsOnly, ordersFeature, validate(analyticsQuerySchema, 'query'), adminController.getCohortRetention);
router.get('/analytics/rfm-segmentation', ...analyticsOnly, ordersFeature, validate(analyticsQuerySchema, 'query'), adminController.getRfmSegmentation);
router.get('/analytics/order-heatmap', ...analyticsOnly, ordersFeature, validate(analyticsQuerySchema, 'query'), adminController.getOrderHeatmap);
router.get('/analytics/revenue-forecast', ...analyticsOnly, ordersFeature, validate(analyticsQuerySchema, 'query'), adminController.getRevenueForecast);
router.get('/analytics/drill-down', ...customerAnalyticsOnly, ordersFeature, adminController.getDrillDown);
router.post('/analytics/send-test-report', ...customerAnalyticsOnly, ordersFeature, adminController.sendTestReport);
const exportMetricFeatureGate = (req, res, next) => {
	if (req.params.metric === 'coupon-performance') {
		return featureGate('coupons')(req, res, next);
	}
	next();
};

router.get('/analytics/export/:metric', ...customerAnalyticsOnly, ordersFeature, exportMetricFeatureGate, adminController.exportAnalyticsCsv);


module.exports = router;
