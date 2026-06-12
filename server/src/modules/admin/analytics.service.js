'use strict';

const { Op, fn, col, literal } = require('sequelize');
const db = require('../index');
const { Order, OrderItem, Cart, CartItem, Product, Category, OrderRefund, User } = db;

const VALID_STATUSES = ['confirmed', 'processing', 'ready_for_shipment', 'closed'];

/**
 * Get date range from params, supporting _dateRange override for comparison.
 */
const getDateRange = (params = {}) => {
  return params._dateRange || resolveDateRange(params.period || '30d');
};

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
 * Compute the previous period date range for comparison.
 * Shifts the same duration backwards from the current period start.
 */
const resolvePreviousDateRange = (period) => {
  const { start, end } = resolveDateRange(period);
  const duration = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - duration),
    end: new Date(start.getTime() - 1),
  };
};

/**
 * Wrap an analytics function with period-over-period comparison.
 * Runs the function for current and previous period, computes % change.
 */
const withComparison = async (fn, params) => {
  const current = await fn(params);
  const previousParams = { ...params, _dateRange: resolvePreviousDateRange(params.period || '30d') };
  const previous = await fn(previousParams);

  const computeChange = (curr, prev) => {
    if (typeof curr === 'number' && typeof prev === 'number') {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
    }
    return null;
  };

  if (Array.isArray(current)) {
    return { current, previous, type: 'array' };
  }

  const changes = {};
  for (const key of Object.keys(current)) {
    if (typeof current[key] === 'number') {
      changes[key] = computeChange(current[key], previous[key]);
    }
  }
  return { current, previous, changes };
};

/**
 * Top selling products by quantity or revenue.
 */
const getTopProducts = async ({ period = '30d', limit = 10, sortBy = 'quantity', _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });

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
const getAbandonedCarts = async ({ period = '30d', _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });
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
const getRevenueByCategory = async ({ period = '30d', limit = 10, _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });

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
const getRepeatCustomers = async ({ period = '30d', _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });

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
const getGeographicSales = async ({ period = '30d', limit = 20, _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });

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
const getRevenueByPaymentMethod = async ({ period = '30d', _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });

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
const getCustomerLifetimeValue = async ({ period = '12m', limit = 10, _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });

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
const getConversionRate = async ({ period = '30d', _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });

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
const getTrafficSources = async ({ period = '30d', limit = 10, _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });

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

/**
 * Product funnel: views → add to cart → purchase for top products.
 */
const getProductFunnel = async ({ period = '30d', limit = 10, _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });

  const tableExists = await db.sequelize.query(
    `SELECT to_regclass('public.page_visits') AS t`,
    { type: db.sequelize.QueryTypes.SELECT }
  );
  if (!tableExists[0]?.t) return [];

  const rows = await db.sequelize.query(`
    WITH product_views AS (
      SELECT product_id, COUNT(*)::int AS views
      FROM page_visits
      WHERE product_id IS NOT NULL AND created_at BETWEEN :start AND :end
      GROUP BY product_id
    ),
    product_carts AS (
      SELECT ci.product_id, COUNT(DISTINCT c.id)::int AS add_to_cart
      FROM cart_items ci
      JOIN carts c ON c.id = ci.cart_id
      WHERE c.created_at BETWEEN :start AND :end
      GROUP BY ci.product_id
    ),
    product_purchases AS (
      SELECT oi.product_id, SUM(oi.quantity)::int AS purchased
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status IN ('confirmed','processing','ready_for_shipment','closed')
        AND o.created_at BETWEEN :start AND :end
        AND oi.product_id IS NOT NULL
      GROUP BY oi.product_id
    )
    SELECT
      p.id AS product_id,
      p.name,
      COALESCE(pv.views, 0) AS views,
      COALESCE(pc.add_to_cart, 0) AS add_to_cart,
      COALESCE(pp.purchased, 0) AS purchased
    FROM products p
    LEFT JOIN product_views pv ON pv.product_id = p.id
    LEFT JOIN product_carts pc ON pc.product_id = p.id
    LEFT JOIN product_purchases pp ON pp.product_id = p.id
    WHERE COALESCE(pv.views, 0) + COALESCE(pc.add_to_cart, 0) + COALESCE(pp.purchased, 0) > 0
    ORDER BY views DESC
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });

  return rows.map((r) => ({
    productId: r.product_id,
    name: r.name,
    views: r.views,
    addToCart: r.add_to_cart,
    purchased: r.purchased,
    viewToCartRate: r.views > 0 ? parseFloat(((r.add_to_cart / r.views) * 100).toFixed(1)) : 0,
    cartToBuyRate: r.add_to_cart > 0 ? parseFloat(((r.purchased / r.add_to_cart) * 100).toFixed(1)) : 0,
  }));
};

/**
 * UTM Marketing Attribution — revenue and orders attributed to UTM campaigns.
 */
const getUtmAttribution = async ({ period = '30d', limit = 20, _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });

  const tableExists = await db.sequelize.query(
    `SELECT to_regclass('public.page_visits') AS t`,
    { type: db.sequelize.QueryTypes.SELECT }
  );
  if (!tableExists[0]?.t) return [];

  // Attribute orders to UTM by matching user_id or session_id from visits to orders
  const rows = await db.sequelize.query(`
    SELECT
      pv.utm_source AS source,
      pv.utm_medium AS medium,
      pv.utm_campaign AS campaign,
      COUNT(DISTINCT o.id)::int AS orders,
      COALESCE(SUM(o.total), 0) AS revenue
    FROM page_visits pv
    JOIN orders o ON (o.user_id = pv.user_id OR o.checkout_session_id::text = pv.session_id)
    WHERE pv.utm_source IS NOT NULL
      AND pv.created_at BETWEEN :start AND :end
      AND o.status IN ('confirmed','processing','ready_for_shipment','closed')
      AND o.created_at BETWEEN :start AND :end
    GROUP BY pv.utm_source, pv.utm_medium, pv.utm_campaign
    ORDER BY revenue DESC
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });

  return rows.map((r) => ({
    source: r.source,
    medium: r.medium,
    campaign: r.campaign,
    orders: r.orders,
    revenue: parseFloat(r.revenue),
  }));
};

/**
 * Coupon performance — usage, revenue, and avg discount per coupon.
 */
const getCouponPerformance = async ({ period = '30d', limit = 10, _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });

  const rows = await db.sequelize.query(`
    SELECT
      c.id AS coupon_id,
      c.code,
      c.discount_type,
      c.discount_value,
      COUNT(o.id)::int AS times_used,
      COALESCE(SUM(o.total), 0) AS revenue_generated,
      COALESCE(SUM(o.discount_amount), 0) AS total_discount_given,
      COALESCE(AVG(o.discount_amount), 0) AS avg_discount
    FROM coupons c
    JOIN orders o ON o.coupon_id = c.id
    WHERE o.status IN ('confirmed','processing','ready_for_shipment','closed')
      AND o.created_at BETWEEN :start AND :end
    GROUP BY c.id, c.code, c.discount_type, c.discount_value
    ORDER BY revenue_generated DESC
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });

  return rows.map((r) => ({
    couponId: r.coupon_id,
    code: r.code,
    discountType: r.discount_type,
    discountValue: parseFloat(r.discount_value),
    timesUsed: r.times_used,
    revenueGenerated: parseFloat(r.revenue_generated),
    totalDiscountGiven: parseFloat(r.total_discount_given),
    avgDiscount: parseFloat(parseFloat(r.avg_discount).toFixed(2)),
  }));
};

/**
 * Cohort Retention Analysis — groups users by signup month and tracks
 * what percentage placed orders in each subsequent month.
 */
const getCohortRetention = async ({ period = '12m' } = {}) => {
  const { start } = resolveDateRange(period);

  const rows = await db.sequelize.query(`
    WITH cohorts AS (
      SELECT
        u.id AS user_id,
        DATE_TRUNC('month', u.created_at)::date AS cohort_month
      FROM users u
      WHERE u.created_at >= :start
        AND u.role = 'customer'
    ),
    cohort_orders AS (
      SELECT
        c.user_id,
        c.cohort_month,
        DATE_TRUNC('month', o.created_at)::date AS order_month
      FROM cohorts c
      JOIN orders o ON o.user_id = c.user_id
      WHERE o.status IN ('confirmed','processing','ready_for_shipment','closed')
    )
    SELECT
      cohort_month,
      EXTRACT(YEAR FROM AGE(order_month, cohort_month)) * 12
        + EXTRACT(MONTH FROM AGE(order_month, cohort_month)) AS months_since,
      COUNT(DISTINCT user_id)::int AS active_users
    FROM cohort_orders
    GROUP BY cohort_month, months_since
    ORDER BY cohort_month, months_since
  `, {
    replacements: { start },
    type: db.sequelize.QueryTypes.SELECT,
  });

  // Get cohort sizes (total users per cohort month)
  const cohortSizes = await db.sequelize.query(`
    SELECT
      DATE_TRUNC('month', created_at)::date AS cohort_month,
      COUNT(*)::int AS cohort_size
    FROM users
    WHERE created_at >= :start AND role = 'customer'
    GROUP BY cohort_month
    ORDER BY cohort_month
  `, {
    replacements: { start },
    type: db.sequelize.QueryTypes.SELECT,
  });

  const sizeMap = {};
  cohortSizes.forEach((r) => { sizeMap[r.cohort_month] = r.cohort_size; });

  // Build matrix: { cohort, size, month0, month1, ... } (values are retention %)
  const cohortMap = {};
  rows.forEach((r) => {
    const key = r.cohort_month;
    if (!cohortMap[key]) cohortMap[key] = { cohort: key, size: sizeMap[key] || 0 };
    const size = sizeMap[key] || 1;
    cohortMap[key][`month${Math.round(r.months_since)}`] = parseFloat(((r.active_users / size) * 100).toFixed(1));
  });

  // Fill missing month0 with 100% for cohorts that have orders
  Object.values(cohortMap).forEach((c) => {
    if (c.month0 === undefined) c.month0 = 100;
  });

  return Object.values(cohortMap).sort((a, b) => new Date(a.cohort) - new Date(b.cohort));
};

/**
 * RFM (Recency, Frequency, Monetary) customer segmentation.
 * Scores each customer on R/F/M and classifies into named segments.
 */
const getRfmSegmentation = async ({ period = '12m' } = {}) => {
  const { start, end } = resolveDateRange(period);

  const rows = await db.sequelize.query(`
    WITH customer_stats AS (
      SELECT
        o.user_id,
        MAX(o.created_at) AS last_order,
        COUNT(o.id)::int AS frequency,
        SUM(o.total)::numeric AS monetary,
        EXTRACT(EPOCH FROM (:end::timestamp - MAX(o.created_at))) / 86400 AS recency_days
      FROM orders o
      WHERE o.status IN ('confirmed','processing','ready_for_shipment','closed')
        AND o.created_at BETWEEN :start AND :end
        AND o.user_id IS NOT NULL
      GROUP BY o.user_id
    ),
    scored AS (
      SELECT
        user_id,
        recency_days,
        frequency,
        monetary,
        NTILE(5) OVER (ORDER BY recency_days ASC) AS r_score,
        NTILE(5) OVER (ORDER BY frequency DESC) AS f_score,
        NTILE(5) OVER (ORDER BY monetary DESC) AS m_score
      FROM customer_stats
    )
    SELECT
      CASE
        WHEN r_score >= 4 AND f_score >= 4 AND m_score >= 4 THEN 'Champions'
        WHEN r_score >= 3 AND f_score >= 3 THEN 'Loyal'
        WHEN r_score >= 4 AND f_score <= 2 THEN 'New Customers'
        WHEN r_score >= 3 AND f_score >= 2 AND m_score >= 3 THEN 'Potential Loyalists'
        WHEN r_score <= 2 AND f_score >= 3 THEN 'At Risk'
        WHEN r_score <= 2 AND f_score >= 4 THEN 'Cant Lose Them'
        WHEN r_score <= 2 AND f_score <= 2 THEN 'Lost'
        ELSE 'Others'
      END AS segment,
      COUNT(*)::int AS customers,
      ROUND(AVG(recency_days))::int AS avg_recency_days,
      ROUND(AVG(frequency))::int AS avg_frequency,
      ROUND(AVG(monetary))::numeric AS avg_monetary
    FROM scored
    GROUP BY segment
    ORDER BY customers DESC
  `, {
    replacements: { start, end },
    type: db.sequelize.QueryTypes.SELECT,
  });

  return rows.map((r) => ({
    segment: r.segment,
    customers: r.customers,
    avgRecencyDays: r.avg_recency_days,
    avgFrequency: r.avg_frequency,
    avgMonetary: parseFloat(r.avg_monetary),
  }));
};

/**
 * Order activity heatmap — orders by day-of-week and hour-of-day.
 */
const getOrderHeatmap = async ({ period = '30d', _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });

  const rows = await db.sequelize.query(`
    SELECT
      EXTRACT(DOW FROM created_at)::int AS day_of_week,
      EXTRACT(HOUR FROM created_at)::int AS hour,
      COUNT(*)::int AS orders
    FROM orders
    WHERE status IN ('confirmed','processing','ready_for_shipment','closed')
      AND created_at BETWEEN :start AND :end
    GROUP BY day_of_week, hour
    ORDER BY day_of_week, hour
  `, {
    replacements: { start, end },
    type: db.sequelize.QueryTypes.SELECT,
  });

  return rows.map((r) => ({
    day: r.day_of_week,
    hour: r.hour,
    orders: r.orders,
  }));
};

/**
 * Revenue forecasting — simple linear regression on daily revenue
 * to project the next 30 days with confidence bands.
 */
const getRevenueForecast = async ({ period = '90d' } = {}) => {
  const { start, end } = resolveDateRange(period);

  const rows = await db.sequelize.query(`
    SELECT
      created_at::date AS date,
      COALESCE(SUM(total), 0)::numeric AS revenue
    FROM orders
    WHERE status IN ('confirmed','processing','ready_for_shipment','closed')
      AND created_at BETWEEN :start AND :end
    GROUP BY date
    ORDER BY date ASC
  `, {
    replacements: { start, end },
    type: db.sequelize.QueryTypes.SELECT,
  });

  if (rows.length < 2) return { actual: [], forecast: [] };

  const data = rows.map((r, i) => ({
    x: i,
    date: r.date,
    revenue: parseFloat(r.revenue),
  }));

  // Linear regression: y = mx + b
  const n = data.length;
  const sumX = data.reduce((s, d) => s + d.x, 0);
  const sumY = data.reduce((s, d) => s + d.revenue, 0);
  const sumXY = data.reduce((s, d) => s + d.x * d.revenue, 0);
  const sumX2 = data.reduce((s, d) => s + d.x * d.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
  const intercept = (sumY - slope * sumX) / n;

  // Standard deviation of residuals for confidence band
  const residuals = data.map((d) => d.revenue - (slope * d.x + intercept));
  const stdDev = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / (n - 1));

  // Actual data points
  const actual = data.map((d) => ({
    date: d.date,
    revenue: d.revenue,
    type: 'actual',
  }));

  // Forecast next 30 days
  const forecast = [];
  for (let i = 0; i < 30; i++) {
    const x = n + i;
    const predicted = slope * x + intercept;
    const date = new Date(end.getTime() + (i + 1) * 864e5).toISOString().slice(0, 10);
    forecast.push({
      date,
      revenue: Math.max(0, parseFloat(predicted.toFixed(2))),
      lower: Math.max(0, parseFloat((predicted - 1.96 * stdDev).toFixed(2))),
      upper: parseFloat((predicted + 1.96 * stdDev).toFixed(2)),
      type: 'forecast',
    });
  }

  return { actual, forecast, trend: slope > 0 ? 'up' : slope < 0 ? 'down' : 'flat' };
};

/**
 * Drill-down — returns paginated orders for a specific analytics dimension.
 * Used when clicking on chart elements to see underlying order details.
 */
const getDrillDown = async ({ metric, filterKey, filterValue, period = '30d', page = 1, limit = 20 } = {}) => {
  const { start, end } = resolveDateRange(period);
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const lim = parseInt(limit, 10);

  let whereExtra = '';
  const replacements = { start, end, limit: lim, offset };

  switch (metric) {
    case 'product':
    case 'top-products':
      whereExtra = 'AND oi.product_id = :filterValue';
      replacements.filterValue = filterValue;
      break;
    case 'category':
    case 'revenue-by-category':
      whereExtra = 'AND EXISTS (SELECT 1 FROM product_categories pc WHERE pc.product_id = oi.product_id AND pc.category_id = :filterValue)';
      replacements.filterValue = filterValue;
      break;
    case 'payment':
    case 'revenue-by-payment':
      whereExtra = 'AND o.payment_method = :filterValue';
      replacements.filterValue = filterValue;
      break;
    case 'geographic-sales':
      whereExtra = "AND o.shipping_address_snapshot->>'state' = :filterValue";
      replacements.filterValue = filterValue;
      break;
    case 'rfm-segmentation':
      whereExtra = `AND o.user_id IN (
        SELECT user_id FROM (
          SELECT o2.user_id,
            CASE
              WHEN NTILE(5) OVER (ORDER BY MAX(o2.created_at) DESC) >= 4
                AND NTILE(5) OVER (ORDER BY COUNT(o2.id) DESC) >= 4
                AND NTILE(5) OVER (ORDER BY SUM(o2.total) DESC) >= 4 THEN 'Champions'
              ELSE 'Others'
            END AS seg
          FROM orders o2
          WHERE o2.status IN ('confirmed','processing','ready_for_shipment','closed')
            AND o2.created_at BETWEEN :start AND :end AND o2.user_id IS NOT NULL
          GROUP BY o2.user_id
        ) sub WHERE seg = :filterValue
      )`;
      replacements.filterValue = filterValue;
      break;
    default:
      break;
  }

  const { count } = await db.sequelize.query(`
    SELECT COUNT(DISTINCT o.id)::int AS count
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status IN ('confirmed','processing','ready_for_shipment','closed')
      AND o.created_at BETWEEN :start AND :end
      ${whereExtra}
  `, {
    replacements,
    type: db.sequelize.QueryTypes.SELECT,
    plain: true,
  }).then((r) => r || { count: 0 });

  const rows = await db.sequelize.query(`
    SELECT DISTINCT ON (o.id)
      o.id,
      o.order_number AS "orderNumber",
      o.status,
      o.total,
      o.payment_method AS "paymentMethod",
      o.created_at AS "createdAt",
      COALESCE(u.first_name || ' ' || u.last_name, 'Guest') AS customer,
      u.email AS "customerEmail"
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status IN ('confirmed','processing','ready_for_shipment','closed')
      AND o.created_at BETWEEN :start AND :end
      ${whereExtra}
    ORDER BY o.id, o.created_at DESC
    LIMIT :limit OFFSET :offset
  `, {
    replacements,
    type: db.sequelize.QueryTypes.SELECT,
  });

  return {
    orders: rows.map((r) => ({
      id: r.id,
      orderNumber: r.orderNumber,
      status: r.status,
      total: parseFloat(r.total),
      paymentMethod: r.paymentMethod,
      createdAt: r.createdAt,
      customer: r.customer,
      customerEmail: r.customerEmail,
    })),
    total: count,
    page: parseInt(page, 10),
    limit: lim,
    totalPages: Math.ceil(count / lim),
  };
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
  getProductFunnel,
  getUtmAttribution,
  getCouponPerformance,
  getCohortRetention,
  getRfmSegmentation,
  getOrderHeatmap,
  getRevenueForecast,
  withComparison,
};
