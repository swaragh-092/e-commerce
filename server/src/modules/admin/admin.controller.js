'use strict';

const AdminService = require('./admin.service');
const AnalyticsService = require('./analytics.service');
const { success, paginated } = require('../../utils/response');

const getStats = async (req, res, next) => {
  try {
    const data = await AdminService.getStats();
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getSalesChart = async (req, res, next) => {
  try {
    const { period = 'monthly', startDate, endDate } = req.query;
    const data = await AdminService.getSalesChart({ period, startDate, endDate });
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getLowStock = async (req, res, next) => {
  try {
    const threshold = req.query.threshold ? parseInt(req.query.threshold, 10) : undefined;
    const data = await AdminService.getLowStock(threshold);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getRecentOrders = async (req, res, next) => {
  try {
    const data = await AdminService.getRecentOrders();
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getAccessRoles = async (req, res, next) => {
  try {
    const roles = await AdminService.getAccessRoles();
    return success(res, roles);
  } catch (err) {
    next(err);
  }
};

const getAccessPermissions = async (req, res, next) => {
  try {
    const permissions = await AdminService.getAccessPermissions();
    return success(res, permissions);
  } catch (err) {
    next(err);
  }
};

const createAccessRole = async (req, res, next) => {
  try {
    const role = await AdminService.createAccessRole(req.validated, req.user.id);
    return success(res, role, 'Role created successfully', 201);
  } catch (err) {
    next(err);
  }
};

const updateAccessRole = async (req, res, next) => {
  try {
    const role = await AdminService.updateAccessRole(req.params.id, req.validated, req.user);
    return success(res, role, 'Role updated successfully');
  } catch (err) {
    next(err);
  }
};

const getAccessUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, roleId, includeCustomers } = req.query;
    const result = await AdminService.listAccessUsers({
      page,
      limit,
      search,
      roleId,
      includeCustomers: includeCustomers === 'true',
    });
    return paginated(res, result.rows, result.count, page, limit);
  } catch (err) {
    next(err);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const user = await AdminService.updateUserRole(req.params.id, req.validated.roleId, req.user.id);
    return success(res, user, 'User role updated successfully');
  } catch (err) {
    next(err);
  }
};

const createStaffUser = async (req, res, next) => {
  try {
    const user = await AdminService.createStaffUser(req.validated, req.user);
    return success(res, user, 'Staff user created successfully', 201);
  } catch (err) {
    next(err);
  }
};

// Analytics
const getTopProducts = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getTopProducts(req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getAovTrend = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getAovTrend(req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getAbandonedCarts = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getAbandonedCarts(req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getRevenueByCategory = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getRevenueByCategory(req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getRepeatCustomers = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getRepeatCustomers(req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getRefundRate = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getRefundRate(req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getGeographicSales = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getGeographicSales(req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getRevenueByPaymentMethod = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getRevenueByPaymentMethod(req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getCustomerLifetimeValue = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getCustomerLifetimeValue(req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getConversionRate = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getConversionRate(req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getTrafficSources = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getTrafficSources(req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

module.exports = {
  getStats,
  getSalesChart,
  getLowStock,
  getRecentOrders,
  getAccessRoles,
  getAccessPermissions,
  createAccessRole,
  updateAccessRole,
  getAccessUsers,
  updateUserRole,
  createStaffUser,
  getTopProducts,
  getAovTrend,
  getAbandonedCarts,
  getRevenueByCategory,
  getRepeatCustomers,
  getRefundRate,
  getGeographicSales,
  getRevenueByPaymentMethod,
  getCustomerLifetimeValue,
  getConversionRate,
  getTrafficSources,
};
