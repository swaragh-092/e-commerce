'use strict';

const AdminService = require('./admin.service');
const { success } = require('../../utils/response');

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
    const { period = 'monthly' } = req.query;
    const data = await AdminService.getSalesChart(period);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getLowStock = async (req, res, next) => {
  try {
    const threshold = parseInt(req.query.threshold, 10) || 10;
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

module.exports = { getStats, getSalesChart, getLowStock, getRecentOrders };
