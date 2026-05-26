'use strict';

const { Op, fn, col, literal } = require('sequelize');
const db = require('../index');
const { Order, OrderItem, Cart, CartItem, Product, Category, OrderRefund, User } = db;

const VALID_STATUSES = ['confirmed', 'processing', 'ready_for_shipment', 'closed'];

/**
 * Resolve a date range from a period string (e.g. '7d', '30d', '90d', '12m').
 */
const resolveDateRange = (period) => {
  const now = new Date();
  let start;
  const match = period.match(/^(\d+)(d|m)$/);
  if (match) {
    const [, num, unit] = match;
    if (unit === 'd') start = new Date(now.getTime() - parseInt(num) * 864e5);
    else start = new Date(now.getFullYear(), now.getMonth() - parseInt(num), now.getDate());
  } else {
    start = new Date(now.getTime() - 30 * 864e5);
  }
  return { start, end: now };
};

/**
 * Top selling products by quantity or revenue.
 */
const getTopProducts = async ({ period = '30d', limit = 10, sortBy = 'quantity' } = {}) => {
  const { start, end } = resolveDateRange(period);

  const orderAttr = sortBy === 'revenue'
    ? [[fn('COALESCE', fn('SUM', col('"OrderItem".total')), 0), 'totalRevenue']]
    : [[fn('COALESCE', fn('SUM', col('"OrderItem".quantity')), 0), 'totalQuantity']];

  const rows = await OrderItem.findAll({
    attributes: [
      'productId',
      [col('"OrderItem".snapshot_name'), 'name'],
      ...orderAttr,
    ],
    include: [{
      model: Order,
      attributes: [],
      where: { status: { [Op.in]: VALID_STATUSES }, createdAt: { [Op.between]: [start, end] } },
    }],
    where: { productId: { [Op.ne]: null } },
    group: ['OrderItem.product_id', '"OrderItem".snapshot_name'],
    order: [[literal(sortBy === 'revenue' ? '"totalRevenue"' : '"totalQuantity"'), 'DESC']],
    limit: parseInt(limit, 10),
    raw: true,
  });

  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    ...(sortBy === 'revenue'
      ? { revenue: parseFloat(r.totalRevenue) }
      : { quantity: parseInt(r.totalQuantity, 10) }),
  }));
};

/**
 * Average Order Value trend over time.
 */
const getAovTrend = async ({ period = 'monthly' } = {}) => {
  const trunc = period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';
  const daysBack = period === 'daily' ? 90 : period === 'weekly' ? 364 : 365;
  const start = new Date(Date.now() - daysBack * 864e5);

  const rows = await Order.findAll({
    attributes: [
      [fn('DATE_TRUNC', trunc, col('"Order".created_at')), 'date'],
      [fn('COALESCE', fn('AVG', col('"Order".total')), 0), 'aov'],
      [fn('COUNT', col('"Order".id')), 'orderCount'],
    ],
    where: {
      status: { [Op.in]: VALID_STATUSES },
      createdAt: { [Op.gte]: start },
    },
    group: [fn('DATE_TRUNC', trunc, col('"Order".created_at'))],
    order: [[fn('DATE_TRUNC', trunc, col('"Order".created_at')), 'ASC']],
    raw: true,
  });

  return rows.map((r) => ({
    date: r.date,
    aov: parseFloat(parseFloat(r.aov).toFixed(2)),
    orderCount: parseInt(r.orderCount, 10),
  }));
};

/**
 * Abandoned cart analytics.
 * A cart is "abandoned" if it has items but status is still 'active' or 'expired' (never converted).
 */
const getAbandonedCarts = async ({ period = '30d' } = {}) => {
  const { start, end } = resolveDateRange(period);
  const dateFilter = { createdAt: { [Op.between]: [start, end] } };

  // Count carts that have at least one item
  const [converted, expired, active, total] = await Promise.all([
    Cart.count({ where: { ...dateFilter, status: 'converted' }, include: [{ model: CartItem, as: 'items', attributes: [], required: true }] }),
    Cart.count({ where: { ...dateFilter, status: 'expired' }, include: [{ model: CartItem, as: 'items', attributes: [], required: true }] }),
    Cart.count({ where: { ...dateFilter, status: 'active' }, include: [{ model: CartItem, as: 'items', attributes: [], required: true }] }),
    Cart.count({ where: dateFilter, include: [{ model: CartItem, as: 'items', attributes: [], required: true }] }),
  ]);

  const abandoned = expired + active;
  const rate = total > 0 ? parseFloat(((abandoned / total) * 100).toFixed(1)) : 0;

  return { total, converted, abandoned, expired, active, rate };
};

/**
 * Revenue breakdown by product category.
 */
const getRevenueByCategory = async ({ period = '30d', limit = 10 } = {}) => {
  const { start, end } = resolveDateRange(period);

  const rows = await db.sequelize.query(`
    SELECT
      COALESCE(c.name, 'Uncategorized') AS category,
      COALESCE(SUM(oi.total), 0) AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN product_categories pc ON pc.product_id = oi.product_id
    LEFT JOIN categories c ON c.id = pc.category_id
    WHERE o.status IN ('confirmed','processing','ready_for_shipment','closed')
      AND o.created_at BETWEEN :start AND :end
      AND oi.product_id IS NOT NULL
    GROUP BY COALESCE(c.name, 'Uncategorized')
    ORDER BY revenue DESC
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });

  return rows.map((r) => ({ category: r.category, revenue: parseFloat(r.revenue) }));
};

/**
 * Repeat customer rate: users with >1 valid order vs one-time buyers.
 */
const getRepeatCustomers = async ({ period = '30d' } = {}) => {
  const { start, end } = resolveDateRange(period);

  const rows = await db.sequelize.query(`
    SELECT
      CASE WHEN order_count > 1 THEN 'repeat' ELSE 'one_time' END AS segment,
      COUNT(*)::int AS customers
    FROM (
      SELECT user_id, COUNT(*) AS order_count
      FROM orders
      WHERE status IN ('confirmed','processing','ready_for_shipment','closed')
        AND created_at BETWEEN :start AND :end
        AND user_id IS NOT NULL
      GROUP BY user_id
    ) sub
    GROUP BY segment
  `, {
    replacements: { start, end },
    type: db.sequelize.QueryTypes.SELECT,
  });

  const repeat = rows.find((r) => r.segment === 'repeat')?.customers || 0;
  const oneTime = rows.find((r) => r.segment === 'one_time')?.customers || 0;
  const total = repeat + oneTime;
  const rate = total > 0 ? parseFloat(((repeat / total) * 100).toFixed(1)) : 0;

  return { repeat, oneTime, total, rate };
};

/**
 * Refund rate trend over time.
 */
const getRefundRate = async ({ period = 'monthly' } = {}) => {
  const trunc = period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';
  const daysBack = period === 'daily' ? 90 : period === 'weekly' ? 364 : 365;
  const start = new Date(Date.now() - daysBack * 864e5);

  const [refundRows, orderRows] = await Promise.all([
    OrderRefund.findAll({
      attributes: [
        [fn('DATE_TRUNC', trunc, col('created_at')), 'date'],
        [fn('COALESCE', fn('SUM', col('amount')), 0), 'refundAmount'],
        [fn('COUNT', col('id')), 'refundCount'],
      ],
      where: { createdAt: { [Op.gte]: start }, status: { [Op.ne]: 'rejected' } },
      group: [fn('DATE_TRUNC', trunc, col('created_at'))],
      order: [[fn('DATE_TRUNC', trunc, col('created_at')), 'ASC']],
      raw: true,
    }),
    Order.findAll({
      attributes: [
        [fn('DATE_TRUNC', trunc, col('"Order".created_at')), 'date'],
        [fn('COALESCE', fn('SUM', col('"Order".total')), 0), 'orderRevenue'],
        [fn('COUNT', col('"Order".id')), 'orderCount'],
      ],
      where: { status: { [Op.in]: VALID_STATUSES }, createdAt: { [Op.gte]: start } },
      group: [fn('DATE_TRUNC', trunc, col('"Order".created_at'))],
      raw: true,
    }),
  ]);

  // Merge by date
  const orderMap = {};
  orderRows.forEach((r) => { orderMap[r.date] = r; });

  return refundRows.map((r) => {
    const orderData = orderMap[r.date] || {};
    const revenue = parseFloat(orderData.orderRevenue || 0);
    const refundAmt = parseFloat(r.refundAmount);
    return {
      date: r.date,
      refundAmount: refundAmt,
      refundCount: parseInt(r.refundCount, 10),
      rate: revenue > 0 ? parseFloat(((refundAmt / revenue) * 100).toFixed(1)) : 0,
    };
  });
};

/**
 * Geographic sales — revenue by state/city from shipping address snapshot.
 */
const getGeographicSales = async ({ period = '30d', limit = 20 } = {}) => {
  const { start, end } = resolveDateRange(period);

  const rows = await db.sequelize.query(`
    SELECT
      COALESCE(shipping_address_snapshot->>'state', 'Unknown') AS state,
      COALESCE(shipping_address_snapshot->>'city', 'Unknown') AS city,
      COUNT(*)::int AS orders,
      COALESCE(SUM(total), 0) AS revenue
    FROM orders
    WHERE status IN ('confirmed','processing','ready_for_shipment','closed')
      AND created_at BETWEEN :start AND :end
      AND shipping_address_snapshot IS NOT NULL
    GROUP BY state, city
    ORDER BY revenue DESC
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });

  return rows.map((r) => ({ state: r.state, city: r.city, orders: r.orders, revenue: parseFloat(r.revenue) }));
};

/**
 * Revenue by payment method.
 */
const getRevenueByPaymentMethod = async ({ period = '30d' } = {}) => {
  const { start, end } = resolveDateRange(period);

  const rows = await Order.findAll({
    attributes: [
      'paymentMethod',
      [fn('COUNT', col('"Order".id')), 'orders'],
      [fn('COALESCE', fn('SUM', col('"Order".total')), 0), 'revenue'],
    ],
    where: {
      status: { [Op.in]: VALID_STATUSES },
      createdAt: { [Op.between]: [start, end] },
    },
    group: ['paymentMethod'],
    order: [[literal('"revenue"'), 'DESC']],
    raw: true,
  });

  return rows.map((r) => ({
    method: r.paymentMethod,
    orders: parseInt(r.orders, 10),
    revenue: parseFloat(r.revenue),
  }));
};

/**
 * Customer Lifetime Value — top customers by total spend (all time or period).
 */
const getCustomerLifetimeValue = async ({ period = '12m', limit = 10 } = {}) => {
  const { start, end } = resolveDateRange(period);

  const rows = await db.sequelize.query(`
    SELECT
      u.id,
      u.first_name || ' ' || u.last_name AS name,
      u.email,
      COUNT(o.id)::int AS orders,
      COALESCE(SUM(o.total), 0) AS lifetime_value,
      MIN(o.created_at) AS first_order,
      MAX(o.created_at) AS last_order
    FROM users u
    JOIN orders o ON o.user_id = u.id
    WHERE o.status IN ('confirmed','processing','ready_for_shipment','closed')
      AND o.created_at BETWEEN :start AND :end
    GROUP BY u.id, u.first_name, u.last_name, u.email
    ORDER BY lifetime_value DESC
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    orders: r.orders,
    lifetimeValue: parseFloat(r.lifetime_value),
    firstOrder: r.first_order,
    lastOrder: r.last_order,
  }));
};

/**
 * Conversion rate — page visits vs orders placed.
 * Reads from page_visits table (created by tracking middleware).
 */
const getConversionRate = async ({ period = '30d' } = {}) => {
  const { start, end } = resolveDateRange(period);

  // Check if page_visits table exists
  const tableExists = await db.sequelize.query(
    `SELECT to_regclass('public.page_visits') AS t`,
    { type: db.sequelize.QueryTypes.SELECT }
  );
  if (!tableExists[0]?.t) {
    return { visits: 0, orders: 0, rate: 0, message: 'Visit tracking not yet active. Data will appear after the migration runs.' };
  }

  const [[{ visits }], orders] = await Promise.all([
    db.sequelize.query(
      `SELECT COUNT(*)::int AS visits FROM page_visits WHERE created_at BETWEEN :start AND :end`,
      { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
    ),
    Order.count({ where: { status: { [Op.in]: VALID_STATUSES }, createdAt: { [Op.between]: [start, end] } } }),
  ]);

  const rate = visits > 0 ? parseFloat(((orders / visits) * 100).toFixed(2)) : 0;
  return { visits, orders, rate };
};

/**
 * Traffic sources — referrer breakdown from page_visits.
 */
const getTrafficSources = async ({ period = '30d', limit = 10 } = {}) => {
  const { start, end } = resolveDateRange(period);

  const tableExists = await db.sequelize.query(
    `SELECT to_regclass('public.page_visits') AS t`,
    { type: db.sequelize.QueryTypes.SELECT }
  );
  if (!tableExists[0]?.t) return [];

  const rows = await db.sequelize.query(`
    SELECT
      COALESCE(NULLIF(referrer_source, ''), 'Direct') AS source,
      COUNT(*)::int AS visits
    FROM page_visits
    WHERE created_at BETWEEN :start AND :end
    GROUP BY source
    ORDER BY visits DESC
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });

  return rows.map((r) => ({ source: r.source, visits: r.visits }));
};

module.exports = {
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
