'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');
const adminController = require('./admin.controller');

const adminOnly = [authenticate, authorize('admin', 'super_admin')];

router.get('/dashboard/stats', ...adminOnly, adminController.getStats);
router.get('/dashboard/sales-chart', ...adminOnly, adminController.getSalesChart);
router.get('/dashboard/low-stock', ...adminOnly, adminController.getLowStock);
router.get('/dashboard/recent-orders', ...adminOnly, adminController.getRecentOrders);

module.exports = router;
