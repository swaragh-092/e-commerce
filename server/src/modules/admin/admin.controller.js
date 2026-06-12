'use strict';

const AdminService = require('./admin.service');
const AnalyticsService = require('./analytics.service');
const AnalyticsReportService = require('./analyticsReport.service');
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

// Analytics — helper to support comparison mode
const analyticsWithCompare = async (methodName, query) => {
  if (query.compare) {
    return AnalyticsService.withComparison(AnalyticsService[methodName], query);
  }
  return AnalyticsService[methodName](query);
};

const getTopProducts = async (req, res, next) => {
  try {
    const data = await analyticsWithCompare('getTopProducts', req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getAovTrend = async (req, res, next) => {
  try {
    const data = await analyticsWithCompare('getAovTrend', req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getAbandonedCarts = async (req, res, next) => {
  try {
    const data = await analyticsWithCompare('getAbandonedCarts', req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getRevenueByCategory = async (req, res, next) => {
  try {
    const data = await analyticsWithCompare('getRevenueByCategory', req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getRepeatCustomers = async (req, res, next) => {
  try {
    const data = await analyticsWithCompare('getRepeatCustomers', req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getRefundRate = async (req, res, next) => {
  try {
    const data = await analyticsWithCompare('getRefundRate', req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getGeographicSales = async (req, res, next) => {
  try {
    const data = await analyticsWithCompare('getGeographicSales', req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getRevenueByPaymentMethod = async (req, res, next) => {
  try {
    const data = await analyticsWithCompare('getRevenueByPaymentMethod', req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getCustomerLifetimeValue = async (req, res, next) => {
  try {
    const data = await analyticsWithCompare('getCustomerLifetimeValue', req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getConversionRate = async (req, res, next) => {
  try {
    const data = await analyticsWithCompare('getConversionRate', req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getTrafficSources = async (req, res, next) => {
  try {
    const data = await analyticsWithCompare('getTrafficSources', req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getProductFunnel = async (req, res, next) => {
  try {
    const data = await analyticsWithCompare('getProductFunnel', req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getUtmAttribution = async (req, res, next) => {
  try {
    const data = await analyticsWithCompare('getUtmAttribution', req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getCouponPerformance = async (req, res, next) => {
  try {
    const data = await analyticsWithCompare('getCouponPerformance', req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const exportAnalyticsCsv = async (req, res, next) => {
  try {
    const { metric } = req.params;
    const methodMap = {
      'top-products': 'getTopProducts',
      'aov-trend': 'getAovTrend',
      'abandoned-carts': 'getAbandonedCarts',
      'revenue-by-category': 'getRevenueByCategory',
      'repeat-customers': 'getRepeatCustomers',
      'refund-rate': 'getRefundRate',
      'geographic-sales': 'getGeographicSales',
      'revenue-by-payment': 'getRevenueByPaymentMethod',
      'customer-lifetime-value': 'getCustomerLifetimeValue',
      'conversion-rate': 'getConversionRate',
      'traffic-sources': 'getTrafficSources',
      'product-funnel': 'getProductFunnel',
      'utm-attribution': 'getUtmAttribution',
      'coupon-performance': 'getCouponPerformance',
      'cohort-retention': 'getCohortRetention',
      'rfm-segmentation': 'getRfmSegmentation',
      'order-heatmap': 'getOrderHeatmap',
      'revenue-forecast': 'getRevenueForecast',
    };
    const method = methodMap[metric];
    if (!method) return res.status(400).json({ success: false, error: { message: 'Invalid metric' } });

    const data = await AnalyticsService[method](req.query);
    const rows = Array.isArray(data) ? data : (data.actual || [data]);
    if (rows.length === 0) return res.status(200).send('');

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${metric}-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(csv);
  } catch (err) { next(err); }
};

const getCohortRetention = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getCohortRetention(req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getRfmSegmentation = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getRfmSegmentation(req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getOrderHeatmap = async (req, res, next) => {
  try {
    const data = await analyticsWithCompare('getOrderHeatmap', req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getRevenueForecast = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getRevenueForecast(req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getDrillDown = async (req, res, next) => {
  try {
    const { metric, filterKey, filterValue, period, page, limit } = req.query;
    const data = await AnalyticsService.getDrillDown({ metric, filterKey, filterValue, period, page, limit });
    return success(res, data);
  } catch (err) { next(err); }
};

const sendTestReport = async (req, res, next) => {
  try {
    await AnalyticsReportService.sendReport();
    return success(res, null, 'Test report sent successfully');
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
  getProductFunnel,
  getUtmAttribution,
  getCouponPerformance,
  exportAnalyticsCsv,
  getCohortRetention,
  getRfmSegmentation,
  getOrderHeatmap,
  getRevenueForecast,
  getDrillDown,
  sendTestReport,
};
