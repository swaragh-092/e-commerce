'use strict';

const { Op, fn, col, literal } = require('sequelize');
const db = require('../index');
const { Order, OrderItem, User, Product } = db;

/**
 * Overall dashboard stats:
 *  totalRevenue, orderCount, customerCount, productCount,
 *  pendingOrders, lowStockCount
 */
const getStats = async () => {
  const [
    revenueResult,
    orderCount,
    customerCount,
    productCount,
    pendingOrders,
    lowStockCount,
  ] = await Promise.all([
    // Total revenue from paid/processing/shipped/delivered orders
    Order.findOne({
      attributes: [[fn('COALESCE', fn('SUM', col('total')), 0), 'totalRevenue']],
      where: { status: { [Op.in]: ['paid', 'processing', 'shipped', 'delivered'] } },
      raw: true,
    }),
    Order.count(),
    User.count({ where: { role: 'customer' } }),
    Product.count({ where: { status: 'published' } }),
    Order.count({ where: { status: 'pending_payment' } }),
    Product.count({
      where: literal('"Product".quantity - "Product".reserved_qty < 10'),
    }),
  ]);

  return {
    totalRevenue: parseFloat(revenueResult?.totalRevenue || 0),
    orderCount,
    customerCount,
    productCount,
    pendingOrders,
    lowStockCount,
  };
};

/**
 * Sales chart data grouped by period.
 * @param {'daily'|'weekly'|'monthly'} period
 */
const getSalesChart = async (period = 'monthly') => {
  const { sequelize } = db;

  // Determine truncation level
  const trunc = period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';

  const rows = await Order.findAll({
    attributes: [
      [fn('DATE_TRUNC', trunc, col('created_at')), 'date'],
      [fn('COALESCE', fn('SUM', col('total')), 0), 'revenue'],
      [fn('COUNT', col('id')), 'orderCount'],
    ],
    where: {
      status: { [Op.in]: ['paid', 'processing', 'shipped', 'delivered'] },
      createdAt: {
        // Last 90 days for daily, last 52 weeks for weekly, last 12 months for monthly
        [Op.gte]: new Date(
          period === 'daily'
            ? Date.now() - 90 * 864e5
            : period === 'weekly'
            ? Date.now() - 364 * 864e5
            : Date.now() - 365 * 864e5,
        ),
      },
    },
    group: [fn('DATE_TRUNC', trunc, col('created_at'))],
    order: [[fn('DATE_TRUNC', trunc, col('created_at')), 'ASC']],
    raw: true,
  });

  return rows.map((r) => ({
    date: r.date,
    revenue: parseFloat(r.revenue),
    orderCount: parseInt(r.orderCount, 10),
  }));
};

/**
 * Low-stock products where available qty < threshold.
 * @param {number} threshold - default 10
 */
const getLowStock = async (threshold = 10) => {
  const rows = await Product.findAll({
    attributes: ['id', 'name', 'quantity', 'reservedQty'],
    where: {
      status: 'published',
      [Op.and]: literal(`"Product".quantity - "Product".reserved_qty < ${parseInt(threshold, 10)}`),
    },
    order: [['quantity', 'ASC']],
    limit: 50,
  });

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    quantity: p.quantity,
    reservedQty: p.reservedQty,
    availableQty: p.quantity - p.reservedQty,
  }));
};

/**
 * Five most recent orders with customer name + status.
 */
const getRecentOrders = async () => {
  const orders = await Order.findAll({
    attributes: ['id', 'orderNumber', 'status', 'total', 'createdAt'],
    include: [
      {
        model: User,
        attributes: ['id', 'firstName', 'lastName', 'email'],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: 5,
  });

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    total: parseFloat(o.total),
    createdAt: o.createdAt,
    customer: o.User
      ? { id: o.User.id, name: `${o.User.firstName} ${o.User.lastName}`, email: o.User.email }
      : null,
  }));
};

module.exports = { getStats, getSalesChart, getLowStock, getRecentOrders };
