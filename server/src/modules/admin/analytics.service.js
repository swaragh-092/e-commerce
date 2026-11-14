'use strict';

const { Op, fn, col, literal } = require('sequelize');
const { randomUUID } = require('crypto');
const db = require('../index');
const { Order, OrderItem, Cart, CartItem, Product, Category, OrderRefund, User } = db;

const VALID_STATUSES = ['confirmed', 'processing', 'ready_for_shipment', 'closed', 'on_hold'];
const VALID_STATUSES_SQL = VALID_STATUSES.map((s) => `'${s}'`).join(',');

/**
 * Get date range from params, supporting _dateRange override for comparison.
 */
const getDateRange = (params = {}) => {
  if (params._dateRange) return params._dateRange;
  if (params.startDate && params.endDate) {
    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(params.endDate)) end.setUTCHours(23, 59, 59, 999);
    return { start, end };
  }
  return resolveDateRange(params.period || '30d');
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
  const currentRange = getDateRange(params);
  const duration = currentRange.end.getTime() - currentRange.start.getTime() + 1;
  const previousRange = params.startDate && params.endDate
    ? { start: new Date(currentRange.start.getTime() - duration), end: new Date(currentRange.start.getTime() - 1) }
    : resolvePreviousDateRange(params.period || '30d');
  const previousParams = { ...params, _dateRange: previousRange };
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

/** Product gross profit using immutable unit-cost snapshots from each order. */
const getProductProfitability = async ({ period = '30d', startDate, endDate, limit = 50, _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, startDate, endDate, _dateRange });
  const rows = await db.sequelize.query(`
    WITH eligible_orders AS (
      SELECT o.id, o.discount_amount, o.applied_discounts
      FROM orders o
      WHERE o.status IN (${VALID_STATUSES_SQL})
        AND o.created_at BETWEEN :start AND :end
    ), refunds AS (
      SELECT r.order_id, SUM(r.amount) AS amount
      FROM order_refunds r JOIN eligible_orders o ON o.id = r.order_id
      WHERE r.status IN ('refunded', 'partially_refunded')
      GROUP BY r.order_id
    ), lines AS (
      SELECT oi.*, SUM(oi.total) OVER (PARTITION BY oi.order_id) AS order_sales,
        COALESCE(coupons.line_discount, 0) AS line_discount,
        GREATEST(0, COALESCE(o.discount_amount, 0) - COALESCE(coupons.accounted_discount, 0)) AS unallocated_discount,
        COALESCE(r.amount, 0) AS refund_amount
      FROM order_items oi JOIN eligible_orders o ON o.id = oi.order_id
      LEFT JOIN refunds r ON r.order_id = o.id
      LEFT JOIN LATERAL (
        SELECT SUM(CASE WHEN jsonb_typeof(d->'lineDiscounts') = 'object'
            AND d->'lineDiscounts' <> '{}'::jsonb
          THEN COALESCE((d->'lineDiscounts'->>CONCAT_WS(':', oi.product_id, oi.variant_id))::numeric, 0)
          ELSE 0 END) AS line_discount,
          SUM(COALESCE((d->>'shippingDiscount')::numeric, 0) +
            CASE WHEN jsonb_typeof(d->'lineDiscounts') = 'object' AND d->'lineDiscounts' <> '{}'::jsonb
              THEN COALESCE((d->>'orderDiscount')::numeric, 0) ELSE 0 END) AS accounted_discount
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.applied_discounts) = 'array'
          THEN o.applied_discounts
          WHEN jsonb_typeof(o.applied_discounts) = 'object' THEN jsonb_build_array(o.applied_discounts)
          ELSE '[]'::jsonb END) d
      ) coupons ON TRUE
    ), discounted AS (
      SELECT lines.*,
        LEAST(total, line_discount + COALESCE(unallocated_discount * total / NULLIF(order_sales, 0), 0)) AS discount
      FROM lines
    ), refundable AS (
      SELECT discounted.*, SUM(total - discount) OVER (PARTITION BY order_id) AS refundable_sales
      FROM discounted
    ), allocated AS (
      SELECT refundable.*,
        COALESCE(LEAST(refundable_sales, refund_amount)
          * (total - discount) / NULLIF(refundable_sales, 0), 0) AS refund
      FROM refundable
    )
    SELECT oi.product_id AS product_id,
      COALESCE(oi.snapshot_name, p.name, 'Deleted product') AS product,
      COALESCE(oi.snapshot_sku, p.sku, '—') AS sku,
      SUM(oi.quantity)::int AS units_sold,
      SUM(oi.total) AS sales,
      ROUND(SUM(oi.discount), 2) AS allocated_discount,
      ROUND(SUM(oi.refund), 2) AS allocated_refund,
      ROUND(SUM(oi.total - oi.discount - oi.refund), 2) AS net_sales,
      ROUND(SUM((oi.total - oi.discount - oi.refund) -
        COALESCE(oi.snapshot_cost_price, pv.cost_price, p.cost_price) * oi.quantity)
        FILTER (WHERE COALESCE(oi.snapshot_cost_price, pv.cost_price, p.cost_price) IS NOT NULL), 2) AS estimated_profit,
      SUM(oi.quantity) FILTER (WHERE oi.snapshot_cost_price IS NULL AND COALESCE(pv.cost_price, p.cost_price) IS NOT NULL) AS estimated_units,
      COALESCE(SUM(CASE WHEN oi.snapshot_cost_price IS NOT NULL
        THEN oi.snapshot_cost_price * oi.quantity ELSE 0 END), 0) AS cost_of_goods,
      COALESCE(SUM(CASE WHEN oi.snapshot_cost_price IS NOT NULL
        THEN oi.total - oi.discount - oi.refund ELSE 0 END), 0) AS costed_sales,
      COALESCE(SUM(CASE WHEN oi.snapshot_cost_price IS NOT NULL
        THEN oi.quantity ELSE 0 END), 0)::int AS costed_units
    FROM allocated oi
    LEFT JOIN products p ON p.id = oi.product_id
    LEFT JOIN product_variants pv ON pv.id = oi.variant_id
    GROUP BY oi.product_id, COALESCE(oi.snapshot_name, p.name, 'Deleted product'),
      COALESCE(oi.snapshot_sku, p.sku, '—')
    ORDER BY net_sales DESC, oi.product_id, product, sku
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });
  return rows.map((row) => {
    const sales = parseFloat(row.sales);
    const costOfGoods = parseFloat(row.cost_of_goods);
    const costedSales = parseFloat(row.costed_sales);
    const grossProfit = Number(row.costed_units) > 0 ? Number((costedSales - costOfGoods).toFixed(2)) : null;
    return {
      productId: row.product_id,
      product: row.product,
      sku: row.sku,
      unitsSold: Number(row.units_sold),
      sales,
      allocatedDiscount: Number(row.allocated_discount),
      allocatedRefund: Number(row.allocated_refund),
      netSales: Number(row.net_sales),
      estimatedUnits: Number(row.estimated_units || 0),
      estimatedGrossProfit: Number(row.estimated_units) > 0 ? Number(row.estimated_profit) : null,
      costOfGoods,
      grossProfit,
      grossMargin: costedSales > 0 ? Number(((grossProfit / costedSales) * 100).toFixed(1)) : null,
      costCoverage: Number(row.units_sold) > 0 ? Number(((Number(row.costed_units) / Number(row.units_sold)) * 100).toFixed(1)) : 0,
    };
  });
};

/** Sales and units grouped by the variant snapshot stored on each order item. */
const getVariantPerformance = async ({ period = '30d', limit = 20, _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });
  const rows = await db.sequelize.query(`
    SELECT
      oi.product_id AS product_id,
      COALESCE(oi.snapshot_name, p.name, 'Deleted product') AS product_name,
      oi.variant_id AS variant_id,
      COALESCE(NULLIF(oi.snapshot_sku, ''), NULLIF(pv.sku, ''), 'Standard') AS variant_sku,
      COUNT(DISTINCT o.id)::int AS orders,
      SUM(oi.quantity)::int AS units_sold,
      COALESCE(SUM(oi.total), 0) AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN products p ON p.id = oi.product_id
    LEFT JOIN product_variants pv ON pv.id = oi.variant_id
    WHERE o.status IN (${VALID_STATUSES_SQL})
      AND o.created_at BETWEEN :start AND :end
    GROUP BY oi.product_id, COALESCE(oi.snapshot_name, p.name, 'Deleted product'),
      oi.variant_id, COALESCE(NULLIF(oi.snapshot_sku, ''), NULLIF(pv.sku, ''), 'Standard')
    ORDER BY revenue DESC
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });

  return rows.map((row) => ({
    productId: row.product_id,
    product: row.product_name,
    variantId: row.variant_id,
    sku: row.variant_sku,
    orders: row.orders,
    unitsSold: row.units_sold,
    revenue: parseFloat(row.revenue),
  }));
};

/** Current available inventory compared with units sold in the selected period. */
const getInventoryPerformance = async ({ period = '30d', limit = 50, _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });
  const days = Math.max(1, (end.getTime() - start.getTime()) / 864e5);
  const rows = await db.sequelize.query(`
    WITH variant_stock AS (
      SELECT product_id, SUM(GREATEST(stock_qty - COALESCE(reserved_qty, 0), 0))::int AS available
      FROM product_variants
      WHERE deleted_at IS NULL AND is_active = TRUE
      GROUP BY product_id
    ), product_sales AS (
      SELECT oi.product_id, SUM(oi.quantity)::int AS units_sold, COALESCE(SUM(oi.total), 0) AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.product_id IS NOT NULL
        AND o.status IN (${VALID_STATUSES_SQL})
        AND o.created_at BETWEEN :start AND :end
      GROUP BY oi.product_id
    )
    SELECT p.id, p.name, p.sku,
      CASE WHEN vs.product_id IS NOT NULL THEN vs.available
           ELSE GREATEST(COALESCE(p.quantity, 0) - COALESCE(p.reserved_qty, 0), 0) END::int AS available_stock,
      COALESCE(ps.units_sold, 0)::int AS units_sold,
      COALESCE(ps.revenue, 0) AS revenue
    FROM products p
    LEFT JOIN variant_stock vs ON vs.product_id = p.id
    LEFT JOIN product_sales ps ON ps.product_id = p.id
    WHERE COALESCE(vs.available, p.quantity, 0) > 0 OR COALESCE(ps.units_sold, 0) > 0
    ORDER BY available_stock ASC, units_sold DESC
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });

  return rows.map((row) => {
    const unitsSold = Number(row.units_sold);
    const availableStock = Number(row.available_stock);
    const dailySales = unitsSold / days;
    return {
      productId: row.id,
      product: row.name,
      sku: row.sku || '—',
      availableStock,
      unitsSold,
      revenue: parseFloat(row.revenue),
      daysOfCover: dailySales > 0 ? Math.round(availableStock / dailySales) : null,
    };
  });
};

/** Historical stockout events and time to the next recorded replenishment. */
const getStockoutHistory = async ({ period = '12m', limit = 50, _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });
  const rows = await db.sequelize.query(`
    WITH stockouts AS (
      SELECT tx.id, tx.product_id, tx.variant_id, tx.created_at,
        (SELECT MIN(next_tx.created_at)
         FROM inventory_transactions next_tx
         WHERE next_tx.product_id = tx.product_id
           AND next_tx.variant_id IS NOT DISTINCT FROM tx.variant_id
           AND next_tx.created_at > tx.created_at
           AND next_tx.after_stock > 0) AS restocked_at
      FROM inventory_transactions tx
      WHERE tx.after_stock = 0
        AND COALESCE(tx.before_stock, 0) > 0
        AND tx.created_at BETWEEN :start AND :end
    )
    SELECT p.id AS product_id, p.name, COALESCE(p.sku, '—') AS sku,
      COUNT(*)::int AS stockout_events,
      COUNT(*) FILTER (WHERE restocked_at IS NULL)::int AS still_out_of_stock,
      MAX(stockouts.created_at) AS last_stockout,
      ROUND(AVG(EXTRACT(EPOCH FROM (restocked_at - stockouts.created_at)) / 86400)::numeric, 1) AS avg_days_to_restock
    FROM stockouts
    JOIN products p ON p.id = stockouts.product_id
    GROUP BY p.id, p.name, COALESCE(p.sku, '—')
    ORDER BY still_out_of_stock DESC, stockout_events DESC
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });
  return rows.map((row) => ({
    productId: row.product_id,
    product: row.name,
    sku: row.sku,
    stockoutEvents: Number(row.stockout_events),
    stillOutOfStock: Number(row.still_out_of_stock),
    lastStockout: row.last_stockout,
    avgDaysToRestock: row.avg_days_to_restock == null ? null : Number(row.avg_days_to_restock),
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
 * Only expired carts are counted as abandoned. Active carts may still belong
 * to shoppers who are browsing, so they are reported separately.
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

  const cartValueRows = await db.sequelize.query(`
    SELECT c.status,
      COALESCE(SUM(ci.quantity * COALESCE(pv.price,
        CASE WHEN p.sale_price IS NOT NULL
          AND (p.sale_start_at IS NULL OR p.sale_start_at <= NOW())
          AND (p.sale_end_at IS NULL OR p.sale_end_at >= NOW())
          THEN p.sale_price ELSE p.price END, 0)), 0) AS estimated_value
    FROM carts c
    JOIN cart_items ci ON ci.cart_id = c.id
    JOIN products p ON p.id = ci.product_id
    LEFT JOIN product_variants pv ON pv.id = ci.variant_id AND pv.deleted_at IS NULL
    WHERE c.created_at BETWEEN :start AND :end
    GROUP BY c.status
  `, {
    replacements: { start, end },
    type: db.sequelize.QueryTypes.SELECT,
  });
  const valuesByStatus = Object.fromEntries(cartValueRows.map((row) => [row.status, Number(row.estimated_value)]));

  const abandoned = expired;
  const completed = converted + abandoned;
  const rate = completed > 0 ? parseFloat(((abandoned / completed) * 100).toFixed(1)) : 0;

  return {
    total,
    converted,
    abandoned,
    expired,
    active,
    completed,
    rate,
    estimatedAbandonedValue: valuesByStatus.expired || 0,
    estimatedActiveValue: valuesByStatus.active || 0,
  };
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
    WHERE o.status IN (${VALID_STATUSES_SQL})
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

/** Order and shipping tax collected by day from recorded order tax fields. */
const getTaxReport = async ({ period = '30d', _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });
  const rows = await db.sequelize.query(`
    SELECT DATE_TRUNC('day', created_at)::date AS date,
      COUNT(*)::int AS orders,
      COALESCE(SUM(tax), 0) AS order_tax,
      COALESCE(SUM(shipping_tax_amount), 0) AS shipping_tax,
      COALESCE(SUM(tax + shipping_tax_amount), 0) AS total_tax
    FROM orders
    WHERE status IN (${VALID_STATUSES_SQL})
      AND created_at BETWEEN :start AND :end
    GROUP BY DATE_TRUNC('day', created_at)::date
    ORDER BY date ASC
  `, {
    replacements: { start, end },
    type: db.sequelize.QueryTypes.SELECT,
  });
  return rows.map((row) => ({
    date: row.date,
    orders: Number(row.orders),
    orderTax: Number(row.order_tax),
    shippingTax: Number(row.shipping_tax),
    totalTax: Number(row.total_tax),
  }));
};

/** Tax components grouped by the destination state recorded on each order. */
const getTaxByState = async ({ period = '30d', limit = 50, _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });
  const rows = await db.sequelize.query(`
    SELECT COALESCE(NULLIF(BTRIM(tax_breakdown->>'destinationState'), ''),
      NULLIF(BTRIM(shipping_address_snapshot->>'state'), ''), 'Unspecified') AS destination,
      COUNT(*)::int AS orders,
      COALESCE(SUM(COALESCE((tax_breakdown->>'cgst')::numeric, 0)), 0) AS cgst,
      COALESCE(SUM(COALESCE((tax_breakdown->>'sgst')::numeric, 0)), 0) AS sgst,
      COALESCE(SUM(COALESCE((tax_breakdown->>'igst')::numeric, 0)), 0) AS igst,
      COALESCE(SUM(COALESCE((tax_breakdown->>'flatTax')::numeric, 0)), 0) AS flat_tax,
      COALESCE(SUM(tax + shipping_tax_amount), 0) AS total_tax
    FROM orders
    WHERE status IN (${VALID_STATUSES_SQL})
      AND created_at BETWEEN :start AND :end
    GROUP BY destination
    ORDER BY total_tax DESC
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });
  return rows.map((row) => ({
    destination: row.destination,
    orders: Number(row.orders),
    cgst: parseFloat(row.cgst),
    sgst: parseFloat(row.sgst),
    igst: parseFloat(row.igst),
    flatTax: parseFloat(row.flat_tax),
    totalTax: parseFloat(row.total_tax),
  }));
};

/** Return request volume by the reason captured on each returned item. */
const getReturnReasons = async ({ period = '30d', limit = 20, _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });
  const rows = await db.sequelize.query(`
    SELECT COALESCE(NULLIF(BTRIM(ri.reason), ''), NULLIF(BTRIM(r.reason), ''), 'No reason provided') AS reason,
      COUNT(DISTINCT r.id)::int AS cases,
      COALESCE(SUM(ri.quantity), 0)::int AS units,
      COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'return_completed')::int AS completed
    FROM order_returns r
    LEFT JOIN order_return_items ri ON ri.return_id = r.id
    WHERE r.type = 'return' AND r.deleted_at IS NULL
      AND r.created_at BETWEEN :start AND :end
    GROUP BY reason
    ORDER BY cases DESC, units DESC
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });
  return rows.map((row) => ({
    reason: row.reason,
    cases: Number(row.cases),
    units: Number(row.units),
    completed: Number(row.completed),
  }));
};

/** Order volume and value grouped by workflow and payment outcome. */
const getOrderStatusReport = async ({ period = '30d', _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });
  const rows = await db.sequelize.query(`
    SELECT o.status AS order_status,
      COALESCE(pay.status, 'no payment record') AS payment_status,
      COUNT(*)::int AS orders,
      COALESCE(SUM(o.total), 0) AS order_value
    FROM orders o
    LEFT JOIN payments pay ON pay.order_id = o.id
    WHERE o.created_at BETWEEN :start AND :end
    GROUP BY o.status, COALESCE(pay.status, 'no payment record')
    ORDER BY orders DESC, order_value DESC
  `, {
    replacements: { start, end },
    type: db.sequelize.QueryTypes.SELECT,
  });
  return rows.map((row) => ({
    orderStatus: row.order_status,
    paymentStatus: row.payment_status,
    orders: Number(row.orders),
    orderValue: parseFloat(row.order_value),
  }));
};

/** Sales split by whether the buyer had placed an earlier eligible order. */
const getCustomerTypeSales = async ({ period = '30d', _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });
  const rows = await db.sequelize.query(`
    WITH valid_orders AS (
      SELECT id, user_id, guest_session_id, total, created_at,
        COALESCE(user_id::text, NULLIF(guest_session_id, '')) AS buyer_key
      FROM orders
      WHERE status IN (${VALID_STATUSES_SQL})
    ), classified_orders AS (
      SELECT current_order.*,
        CASE WHEN EXISTS (
          SELECT 1 FROM valid_orders earlier
          WHERE earlier.buyer_key = current_order.buyer_key
            AND earlier.created_at < current_order.created_at
        ) THEN 'Returning' ELSE 'New' END AS customer_type
      FROM valid_orders current_order
      WHERE current_order.created_at BETWEEN :start AND :end
    )
    SELECT customer_type, COUNT(*)::int AS orders,
      COALESCE(SUM(total), 0) AS order_value,
      COUNT(DISTINCT buyer_key)::int AS customers
    FROM classified_orders
    GROUP BY customer_type
    ORDER BY customer_type
  `, {
    replacements: { start, end },
    type: db.sequelize.QueryTypes.SELECT,
  });
  return rows.map((row) => ({
    customerType: row.customer_type,
    orders: Number(row.orders),
    orderValue: parseFloat(row.order_value),
    customers: Number(row.customers),
  }));
};

/** Completed return rates by product, matched to the original order period. */
const getProductReturnRates = async ({ period = '30d', limit = 20, _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });
  const rows = await db.sequelize.query(`
    WITH sales AS (
      SELECT oi.product_id, SUM(oi.quantity)::int AS units_sold
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.product_id IS NOT NULL
        AND o.status IN (${VALID_STATUSES_SQL})
        AND o.created_at BETWEEN :start AND :end
      GROUP BY oi.product_id
    ), returned AS (
      SELECT oi.product_id,
        SUM(ri.quantity)::int AS units_returned,
        SUM(CASE WHEN oi.quantity > 0 THEN oi.total * ri.quantity / oi.quantity ELSE 0 END) AS returned_value
      FROM order_returns r
      JOIN orders o ON o.id = r.order_id
      JOIN order_return_items ri ON ri.return_id = r.id
      JOIN order_items oi ON oi.id = ri.order_item_id
      WHERE r.type = 'return' AND r.status = 'return_completed'
        AND r.deleted_at IS NULL
        AND o.created_at BETWEEN :start AND :end
        AND oi.product_id IS NOT NULL
      GROUP BY oi.product_id
    )
    SELECT p.id AS product_id, p.name, p.sku,
      s.units_sold, r.units_returned, r.returned_value,
      ROUND(r.units_returned::numeric * 100 / NULLIF(s.units_sold, 0), 1) AS return_rate
    FROM returned r
    JOIN sales s ON s.product_id = r.product_id
    JOIN products p ON p.id = r.product_id
    ORDER BY return_rate DESC, r.units_returned DESC
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });
  return rows.map((row) => ({
    productId: row.product_id,
    product: row.name,
    sku: row.sku || '—',
    unitsSold: Number(row.units_sold),
    unitsReturned: Number(row.units_returned),
    returnRate: Number(row.return_rate),
    returnedValue: parseFloat(row.returned_value),
  }));
};

/** Shipment status, carrier, and overdue delivery counts for placed orders. */
const getShippingPerformance = async ({ period = '30d', limit = 50, _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });
  const rows = await db.sequelize.query(`
    WITH shipment_metrics AS (
      SELECT s.id, s.order_id, s.courier_name, s.status, s.expected_delivery_date, s.created_at,
        MIN(e.event_timestamp) FILTER (WHERE LOWER(e.event_status) = 'delivered') AS delivered_at
      FROM shipments s
      JOIN orders o ON o.id = s.order_id
      LEFT JOIN shipment_events e ON e.shipment_id = s.id
      WHERE o.created_at BETWEEN :start AND :end
      GROUP BY s.id, s.order_id, s.courier_name, s.status, s.expected_delivery_date, s.created_at
    )
    SELECT COALESCE(NULLIF(BTRIM(courier_name), ''), 'Unassigned') AS carrier,
      status AS shipment_status,
      COUNT(*)::int AS shipments,
      COUNT(DISTINCT order_id)::int AS orders,
      COUNT(*) FILTER (
        WHERE expected_delivery_date < CURRENT_DATE
          AND status NOT IN ('delivered', 'rto', 'cancelled')
      )::int AS overdue,
      ROUND(AVG(EXTRACT(EPOCH FROM (delivered_at - created_at)) / 86400)::numeric, 1) AS avg_delivery_days,
      COUNT(*) FILTER (WHERE delivered_at IS NOT NULL AND expected_delivery_date IS NOT NULL
        AND delivered_at::date > expected_delivery_date)::int AS delivered_late
    FROM shipment_metrics
    GROUP BY carrier, status
    ORDER BY overdue DESC, shipments DESC
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });
  return rows.map((row) => ({
    carrier: row.carrier,
    shipmentStatus: row.shipment_status,
    shipments: Number(row.shipments),
    orders: Number(row.orders),
    overdue: Number(row.overdue),
    avgDeliveryDays: row.avg_delivery_days == null ? null : Number(row.avg_delivery_days),
    deliveredLate: Number(row.delivered_late),
  }));
};

/** Daily order amounts and completed refunds, kept separate for reconciliation. */
const getSalesReconciliation = async ({ period = '30d', _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });
  const rows = await db.sequelize.query(`
    WITH order_totals AS (
      SELECT o.id, o.created_at, o.subtotal, o.discount_amount, o.tax,
        o.shipping_cost, o.shipping_tax_amount, o.total
      FROM orders o
      WHERE o.status IN (${VALID_STATUSES_SQL})
        AND o.created_at BETWEEN :start AND :end
    ), refunds AS (
      SELECT r.order_id, SUM(r.amount) AS refunded
      FROM order_refunds r
      JOIN order_totals ot ON ot.id = r.order_id
      WHERE r.status IN ('refunded', 'partially_refunded')
      GROUP BY r.order_id
    )
    SELECT DATE_TRUNC('day', ot.created_at)::date AS date,
      COUNT(*)::int AS orders,
      COALESCE(SUM(ot.subtotal), 0) AS subtotal,
      COALESCE(SUM(ot.discount_amount), 0) AS discounts,
      COALESCE(SUM(ot.tax + ot.shipping_tax_amount), 0) AS tax,
      COALESCE(SUM(ot.shipping_cost), 0) AS shipping,
      COALESCE(SUM(ot.total), 0) AS order_total,
      COALESCE(SUM(refunds.refunded), 0) AS refunds,
      COALESCE(SUM(ot.total), 0) - COALESCE(SUM(refunds.refunded), 0) AS net_after_refunds
    FROM order_totals ot
    LEFT JOIN refunds ON refunds.order_id = ot.id
    GROUP BY DATE_TRUNC('day', ot.created_at)::date
    ORDER BY date ASC
  `, {
    replacements: { start, end },
    type: db.sequelize.QueryTypes.SELECT,
  });
  return rows.map((row) => ({
    date: row.date,
    orders: Number(row.orders),
    subtotal: parseFloat(row.subtotal),
    discounts: parseFloat(row.discounts),
    tax: parseFloat(row.tax),
    shipping: parseFloat(row.shipping),
    orderTotal: parseFloat(row.order_total),
    refunds: parseFloat(row.refunds),
    netAfterRefunds: parseFloat(row.net_after_refunds),
  }));
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
      WHERE status IN (${VALID_STATUSES_SQL})
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
    WHERE status IN (${VALID_STATUSES_SQL})
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
    WHERE o.status IN (${VALID_STATUSES_SQL})
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
 * Conversion rate — distinct visitors vs orders placed. Page views are also
 * returned so the dashboard can distinguish traffic volume from reach.
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
    return { visits: 0, visitors: 0, orders: 0, rate: 0, message: 'Visit tracking not yet active. Data will appear after the migration runs.' };
  }

  const [visitRows, orderCount] = await Promise.all([
    db.sequelize.query(
      `SELECT
         COUNT(*)::int AS visits,
         COUNT(DISTINCT COALESCE(user_id::text, NULLIF(session_id, '')))::int AS visitors
       FROM page_visits
       WHERE created_at BETWEEN :start AND :end`,
      { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
    ),
    Order.count({ where: { status: { [Op.in]: VALID_STATUSES }, createdAt: { [Op.between]: [start, end] } } }),
  ]);

  const { visits, visitors } = visitRows[0] || {};
  const visitorCount = Number(visitors || 0);
  const rate = visitorCount > 0 ? parseFloat(((orderCount / visitorCount) * 100).toFixed(2)) : 0;
  return { visits: Number(visits || 0), visitors: visitorCount, orders: orderCount, rate };
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
    WITH source_visits AS (
      SELECT COALESCE(NULLIF(referrer_source, ''), 'Direct') AS source,
        COUNT(*)::int AS visits,
        COUNT(DISTINCT COALESCE(user_id::text, NULLIF(session_id, '')))::int AS visitors
      FROM page_visits
      WHERE created_at BETWEEN :start AND :end
      GROUP BY source
    ), attributed_orders AS (
      SELECT COALESCE(NULLIF(touch.referrer_source, ''), 'Direct') AS source,
        COUNT(*)::int AS orders,
        COALESCE(SUM(o.total), 0) AS revenue
      FROM orders o
      LEFT JOIN LATERAL (
        SELECT visit.referrer_source
        FROM page_visits visit
        WHERE ((o.user_id IS NOT NULL AND visit.user_id = o.user_id)
          OR (o.checkout_session_id IS NOT NULL AND visit.session_id = o.checkout_session_id::text))
          AND visit.created_at <= o.created_at
        ORDER BY visit.created_at DESC
        LIMIT 1
      ) touch ON TRUE
      WHERE o.status IN (${VALID_STATUSES_SQL})
        AND o.created_at BETWEEN :start AND :end
      GROUP BY source
    )
    SELECT COALESCE(sv.source, ao.source) AS source,
      COALESCE(sv.visits, 0)::int AS visits,
      COALESCE(sv.visitors, 0)::int AS visitors,
      COALESCE(ao.orders, 0)::int AS orders,
      COALESCE(ao.revenue, 0) AS revenue,
      CASE WHEN COALESCE(sv.visitors, 0) > 0
        THEN ROUND(COALESCE(ao.orders, 0)::numeric * 100 / sv.visitors, 2)
        ELSE 0 END AS conversion_rate
    FROM source_visits sv
    FULL OUTER JOIN attributed_orders ao ON ao.source = sv.source
    ORDER BY visits DESC, revenue DESC
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });

  return rows.map((r) => ({
    source: r.source,
    visits: r.visits,
    visitors: r.visitors,
    orders: r.orders,
    revenue: parseFloat(r.revenue),
    conversionRate: parseFloat(r.conversion_rate),
  }));
};

/** First recorded storefront page per visitor, with order attribution. */
const getLandingPagePerformance = async ({ period = '30d', limit = 20, _dateRange, startDate, endDate } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange, startDate, endDate });
  const tableExists = await db.sequelize.query(
    `SELECT to_regclass('public.page_visits') AS t`,
    { type: db.sequelize.QueryTypes.SELECT }
  );
  if (!tableExists[0]?.t) return [];
  const rows = await db.sequelize.query(`
    WITH first_landing AS (
      SELECT DISTINCT ON (COALESCE(user_id::text, NULLIF(session_id, '')))
        user_id, session_id, COALESCE(user_id::text, NULLIF(session_id, '')) AS visitor_key,
        path, created_at
      FROM page_visits
      WHERE created_at BETWEEN :start AND :end
        AND COALESCE(user_id::text, NULLIF(session_id, '')) IS NOT NULL
      ORDER BY COALESCE(user_id::text, NULLIF(session_id, '')), created_at ASC
    ), page_visitors AS (
      SELECT path, COUNT(*)::int AS visitors
      FROM first_landing
      GROUP BY path
    ), attributed_orders AS (
      SELECT landing.path,
        COUNT(*)::int AS orders,
        COALESCE(SUM(o.total), 0) AS revenue
      FROM orders o
      JOIN LATERAL (
        SELECT fl.path
        FROM first_landing fl
        WHERE (o.user_id IS NOT NULL AND fl.user_id = o.user_id)
          OR (o.checkout_session_id IS NOT NULL AND fl.session_id = o.checkout_session_id::text)
        ORDER BY fl.created_at ASC
        LIMIT 1
      ) landing ON TRUE
      WHERE o.status IN (${VALID_STATUSES_SQL})
        AND o.created_at BETWEEN :start AND :end
      GROUP BY landing.path
    )
    SELECT pv.path, pv.visitors, COALESCE(ao.orders, 0)::int AS orders,
      COALESCE(ao.revenue, 0) AS revenue,
      CASE WHEN pv.visitors > 0 THEN ROUND(COALESCE(ao.orders, 0)::numeric * 100 / pv.visitors, 2) ELSE 0 END AS conversion_rate
    FROM page_visitors pv
    LEFT JOIN attributed_orders ao ON ao.path = pv.path
    ORDER BY visitors DESC, revenue DESC
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });
  return rows.map((row) => ({
    path: row.path,
    visitors: Number(row.visitors),
    orders: Number(row.orders),
    revenue: parseFloat(row.revenue),
    conversionRate: parseFloat(row.conversion_rate),
  }));
};

/** Visitor and order performance grouped by the recorded browser device class. */
const getDevicePerformance = async ({ period = '30d', limit = 10, _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });
  const tableExists = await db.sequelize.query(
    `SELECT to_regclass('public.page_visits') AS t`,
    { type: db.sequelize.QueryTypes.SELECT }
  );
  if (!tableExists[0]?.t) return [];
  const rows = await db.sequelize.query(`
    WITH visits AS (
      SELECT CASE
        WHEN user_agent ~* 'ipad|tablet|kindle|silk' THEN 'Tablet'
        WHEN user_agent ~* 'mobile|android|iphone|ipod' THEN 'Mobile'
        WHEN NULLIF(user_agent, '') IS NULL THEN 'Unknown'
        ELSE 'Desktop'
      END AS device,
      COUNT(*)::int AS page_views,
      COUNT(DISTINCT COALESCE(user_id::text, NULLIF(session_id, '')))::int AS visitors
      FROM page_visits
      WHERE created_at BETWEEN :start AND :end
      GROUP BY device
    ), attributed_orders AS (
      SELECT COALESCE(touch.device, 'Unknown') AS device,
        COUNT(*)::int AS orders,
        COALESCE(SUM(o.total), 0) AS revenue
      FROM orders o
      LEFT JOIN LATERAL (
        SELECT CASE
          WHEN visit.user_agent ~* 'ipad|tablet|kindle|silk' THEN 'Tablet'
          WHEN visit.user_agent ~* 'mobile|android|iphone|ipod' THEN 'Mobile'
          WHEN NULLIF(visit.user_agent, '') IS NULL THEN 'Unknown'
          ELSE 'Desktop'
        END AS device
        FROM page_visits visit
        WHERE ((o.user_id IS NOT NULL AND visit.user_id = o.user_id)
          OR (o.checkout_session_id IS NOT NULL AND visit.session_id = o.checkout_session_id::text))
          AND visit.created_at <= o.created_at
        ORDER BY visit.created_at DESC
        LIMIT 1
      ) touch ON TRUE
      WHERE o.status IN (${VALID_STATUSES_SQL})
        AND o.created_at BETWEEN :start AND :end
      GROUP BY device
    )
    SELECT COALESCE(v.device, ao.device) AS device,
      COALESCE(v.page_views, 0)::int AS page_views,
      COALESCE(v.visitors, 0)::int AS visitors,
      COALESCE(ao.orders, 0)::int AS orders,
      COALESCE(ao.revenue, 0) AS revenue,
      CASE WHEN COALESCE(v.visitors, 0) > 0
        THEN ROUND(COALESCE(ao.orders, 0)::numeric * 100 / v.visitors, 2)
        ELSE 0 END AS conversion_rate
    FROM visits v
    FULL OUTER JOIN attributed_orders ao ON ao.device = v.device
    ORDER BY visitors DESC, revenue DESC
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });
  return rows.map((row) => ({
    device: row.device,
    pageViews: Number(row.page_views),
    visitors: Number(row.visitors),
    orders: Number(row.orders),
    revenue: parseFloat(row.revenue),
    conversionRate: parseFloat(row.conversion_rate),
  }));
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
      SELECT product_id,
        COUNT(DISTINCT COALESCE(user_id::text, NULLIF(session_id, '')))::int AS views
      FROM page_visits
      WHERE product_id IS NOT NULL AND created_at BETWEEN :start AND :end
        AND (user_id IS NOT NULL OR NULLIF(session_id, '') IS NOT NULL)
      GROUP BY product_id
    ),
    product_carts AS (
      SELECT ci.product_id,
        COUNT(DISTINCT COALESCE(c.user_id::text, NULLIF(c.session_id, '')))::int AS add_to_cart
      FROM cart_items ci
      JOIN carts c ON c.id = ci.cart_id
      WHERE c.created_at BETWEEN :start AND :end
        AND (c.user_id IS NOT NULL OR NULLIF(c.session_id, '') IS NOT NULL)
      GROUP BY ci.product_id
    ),
    product_purchases AS (
      SELECT oi.product_id,
        COUNT(DISTINCT COALESCE(o.user_id::text, NULLIF(o.guest_session_id, '')))::int AS orders,
        SUM(oi.quantity)::int AS purchased
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status IN (${VALID_STATUSES_SQL})
        AND o.created_at BETWEEN :start AND :end
        AND (o.user_id IS NOT NULL OR NULLIF(o.guest_session_id, '') IS NOT NULL)
        AND oi.product_id IS NOT NULL
      GROUP BY oi.product_id
    )
    SELECT
      p.id AS product_id,
      p.name,
      COALESCE(pv.views, 0) AS views,
      COALESCE(pc.add_to_cart, 0) AS add_to_cart,
      COALESCE(pp.orders, 0) AS orders,
      COALESCE(pp.purchased, 0) AS purchased
    FROM products p
    LEFT JOIN product_views pv ON pv.product_id = p.id
    LEFT JOIN product_carts pc ON pc.product_id = p.id
    LEFT JOIN product_purchases pp ON pp.product_id = p.id
    WHERE COALESCE(pv.views, 0) + COALESCE(pc.add_to_cart, 0) + COALESCE(pp.orders, 0) > 0
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
    orders: r.orders,
    purchased: r.purchased,
    viewToCartRate: r.views > 0 ? parseFloat(((r.add_to_cart / r.views) * 100).toFixed(1)) : 0,
    cartToBuyRate: r.add_to_cart > 0 ? parseFloat(((r.orders / r.add_to_cart) * 100).toFixed(1)) : 0,
  }));
};

/** Storewide visitor funnel from tracked product views through completed orders. */
const getCheckoutFunnel = async ({ period = '30d', _dateRange, startDate, endDate } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange, startDate, endDate });
  const tables = await db.sequelize.query(`
    SELECT to_regclass('public.page_visits') AS visits_table,
      to_regclass('public.storefront_analytics_events') AS events_table
  `, { type: db.sequelize.QueryTypes.SELECT });
  if (!tables[0]?.visits_table || !tables[0]?.events_table) {
    return { productViews: 0, addToCart: 0, checkoutStarted: 0, purchases: 0, trackingAvailable: false };
  }

  const [row] = await db.sequelize.query(`
    WITH product_visitors AS (
      SELECT COUNT(DISTINCT COALESCE(user_id::text, NULLIF(session_id, ''))) AS count
      FROM page_visits
      WHERE product_id IS NOT NULL AND created_at BETWEEN :start AND :end
        AND COALESCE(user_id::text, NULLIF(session_id, '')) IS NOT NULL
    ), cart_visitors AS (
      SELECT COUNT(DISTINCT COALESCE(user_id::text, NULLIF(session_id, ''))) AS count
      FROM storefront_analytics_events
      WHERE event_name = 'cart_added' AND created_at BETWEEN :start AND :end
        AND COALESCE(user_id::text, NULLIF(session_id, '')) IS NOT NULL
    ), checkout_visitors AS (
      SELECT COUNT(DISTINCT COALESCE(user_id::text, checkout_session_id::text, NULLIF(session_id, ''))) AS count
      FROM storefront_analytics_events
      WHERE event_name = 'checkout_started' AND created_at BETWEEN :start AND :end
        AND COALESCE(user_id::text, checkout_session_id::text, NULLIF(session_id, '')) IS NOT NULL
    ), buying_visitors AS (
      SELECT COUNT(DISTINCT COALESCE(user_id::text, checkout_session_id::text, NULLIF(guest_session_id, ''))) AS count
      FROM orders
      WHERE status IN (${VALID_STATUSES_SQL}) AND created_at BETWEEN :start AND :end
        AND COALESCE(user_id::text, checkout_session_id::text, NULLIF(guest_session_id, '')) IS NOT NULL
    )
    SELECT product_visitors.count::int AS product_views,
      cart_visitors.count::int AS add_to_cart,
      checkout_visitors.count::int AS checkout_started,
      buying_visitors.count::int AS purchases
    FROM product_visitors, cart_visitors, checkout_visitors, buying_visitors
  `, {
    replacements: { start, end },
    type: db.sequelize.QueryTypes.SELECT,
  });
  return {
    productViews: Number(row.product_views),
    addToCart: Number(row.add_to_cart),
    checkoutStarted: Number(row.checkout_started),
    purchases: Number(row.purchases),
    trackingAvailable: true,
  };
};

/**
 * UTM Marketing Attribution — revenue and orders attributed to UTM campaigns.
 */
const getUtmAttribution = async ({ period = '30d', limit = 20, attribution = 'last', _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });
  const touchOrder = attribution === 'first' ? 'ASC' : 'DESC';
  const sourceExpr = attribution === 'first' ? 'pv.utm_source' : "COALESCE(NULLIF(o.utm_source, ''), pv.utm_source)";
  const mediumExpr = attribution === 'first' ? 'pv.utm_medium' : "COALESCE(NULLIF(o.utm_medium, ''), pv.utm_medium)";
  const campaignExpr = attribution === 'first' ? 'pv.utm_campaign' : "COALESCE(NULLIF(o.utm_campaign, ''), pv.utm_campaign)";

  const tableExists = await db.sequelize.query(
    `SELECT to_regclass('public.page_visits') AS t`,
    { type: db.sequelize.QueryTypes.SELECT }
  );
  if (!tableExists[0]?.t) return [];

  // Assign each order to the selected campaign touch before checkout.
  // Aggregating visits directly can count one order's revenue under several campaigns.
  const rows = await db.sequelize.query(`
    SELECT
      ${sourceExpr} AS source,
      ${mediumExpr} AS medium,
      ${campaignExpr} AS campaign,
      COUNT(*)::int AS orders,
      COALESCE(SUM(o.total), 0) AS revenue,
      COUNT(DISTINCT COALESCE(o.user_id::text, NULLIF(o.guest_session_id, '')))::int AS customers,
      COUNT(DISTINCT COALESCE(o.user_id::text, NULLIF(o.guest_session_id, ''))) FILTER (
        WHERE COALESCE(o.user_id::text, NULLIF(o.guest_session_id, '')) IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM orders earlier
            WHERE COALESCE(earlier.user_id::text, NULLIF(earlier.guest_session_id, ''))
              = COALESCE(o.user_id::text, NULLIF(o.guest_session_id, ''))
              AND earlier.status IN (${VALID_STATUSES_SQL})
              AND earlier.created_at < o.created_at
          )
      )::int AS new_customers
    FROM orders o
    LEFT JOIN LATERAL (
      SELECT visit.utm_source, visit.utm_medium, visit.utm_campaign
      FROM page_visits visit
      WHERE ((o.user_id IS NOT NULL AND visit.user_id = o.user_id)
        OR (o.checkout_session_id IS NOT NULL AND visit.session_id = o.checkout_session_id::text))
        AND visit.created_at <= o.created_at
        AND NULLIF(visit.utm_source, '') IS NOT NULL
      ORDER BY visit.created_at ${touchOrder}
      LIMIT 1
    ) pv ON TRUE
    WHERE ${sourceExpr} IS NOT NULL
      AND o.status IN (${VALID_STATUSES_SQL})
      AND o.created_at BETWEEN :start AND :end
    GROUP BY ${sourceExpr}, ${mediumExpr}, ${campaignExpr}
    ORDER BY revenue DESC
    LIMIT :limit
  `, {
    replacements: { start, end, limit: parseInt(limit, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  });

  const spendTable = await db.sequelize.query(
    `SELECT to_regclass('public.campaign_spends') AS table_name`,
    { type: db.sequelize.QueryTypes.SELECT }
  );
  const spendRows = spendTable[0]?.table_name ? await db.sequelize.query(`
    SELECT source, medium, campaign, COALESCE(SUM(amount), 0) AS spend
    FROM campaign_spends
    WHERE spend_date BETWEEN :startDate AND :endDate
    GROUP BY source, medium, campaign
  `, {
    replacements: { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) },
    type: db.sequelize.QueryTypes.SELECT,
  }) : [];
  const keyOf = (row) => JSON.stringify([row.source || '', row.medium || '', row.campaign || '']);
  const merged = new Map(rows.map((row) => [keyOf(row), {
    source: row.source,
    medium: row.medium,
    campaign: row.campaign,
    orders: Number(row.orders),
    customers: Number(row.customers),
    newCustomers: Number(row.new_customers),
    revenue: parseFloat(row.revenue),
    spend: 0,
  }]));
  for (const spendRow of spendRows) {
    const key = keyOf(spendRow);
    const reportRow = merged.get(key) || {
      source: spendRow.source, medium: spendRow.medium, campaign: spendRow.campaign,
      orders: 0, customers: 0, newCustomers: 0, revenue: 0, spend: 0,
    };
    reportRow.spend = parseFloat(spendRow.spend);
    merged.set(key, reportRow);
  }
  return [...merged.values()]
    .map((row) => ({
      ...row,
      cac: row.newCustomers > 0 ? Number((row.spend / row.newCustomers).toFixed(2)) : null,
      roas: row.spend > 0 ? Number((row.revenue / row.spend).toFixed(2)) : null,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, parseInt(limit, 10));
};

const saveCampaignSpend = async ({ spendDate, source, medium = '', campaign, amount }) => {
  const normalized = {
    id: randomUUID(),
    spendDate,
    source: source.trim(),
    medium: medium.trim(),
    campaign: campaign.trim(),
    amount,
  };
  await db.sequelize.query(`
    INSERT INTO campaign_spends (id, spend_date, source, medium, campaign, amount, created_at, updated_at)
    VALUES (:id, :spendDate, :source, :medium, :campaign, :amount, NOW(), NOW())
    ON CONFLICT (spend_date, source, medium, campaign)
    DO UPDATE SET amount = EXCLUDED.amount, updated_at = NOW()
  `, { replacements: normalized });
  return normalized;
};

/**
 * Coupon performance — usage, revenue, and avg discount per coupon.
 */
const getCouponPerformance = async ({ period = '30d', limit = 10, _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange });

  const rows = await db.sequelize.query(`
    WITH order_coupons AS (
      SELECT
        o.id AS order_id,
        o.total AS order_total,
        (d->>'couponId') AS coupon_id,
        COALESCE((d->>'totalDiscount')::numeric, 0) AS discount_amount
      FROM orders o
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(o.applied_discounts) = 'array' THEN o.applied_discounts
          ELSE '[]'::jsonb
        END
      ) AS d
      WHERE o.status IN (${VALID_STATUSES_SQL})
        AND o.created_at BETWEEN :start AND :end
        AND d->>'couponId' IS NOT NULL

      UNION ALL

      SELECT
        o.id AS order_id,
        o.total AS order_total,
        o.coupon_id::text AS coupon_id,
        COALESCE(o.discount_amount, 0) AS discount_amount
      FROM orders o
      WHERE o.status IN (${VALID_STATUSES_SQL})
        AND o.created_at BETWEEN :start AND :end
        AND o.coupon_id IS NOT NULL
        AND (
          o.applied_discounts IS NULL
          OR jsonb_typeof(o.applied_discounts) != 'array'
          OR jsonb_array_length(o.applied_discounts) = 0
        )
    )
    SELECT
      c.id AS coupon_id,
      c.code,
      c.type AS discount_type,
      c.value AS discount_value,
      COUNT(oc.order_id)::int AS times_used,
      COALESCE(SUM(oc.order_total), 0) AS revenue_generated,
      COALESCE(SUM(oc.discount_amount), 0) AS total_discount_given,
      COALESCE(AVG(oc.discount_amount), 0) AS avg_discount
    FROM coupons c
    JOIN order_coupons oc ON c.id::text = oc.coupon_id
    GROUP BY c.id, c.code, c.type, c.value
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
const getCohortRetention = async ({ period = '12m', _dateRange, startDate, endDate } = {}) => {
  const { start } = getDateRange({ period, _dateRange, startDate, endDate });

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
        DATE_TRUNC('month', o.created_at)::date AS order_month,
        o.total AS order_value
      FROM cohorts c
      JOIN orders o ON o.user_id = c.user_id
      WHERE o.status IN (${VALID_STATUSES_SQL})
    )
    SELECT
      cohort_month,
      EXTRACT(YEAR FROM AGE(order_month, cohort_month)) * 12
        + EXTRACT(MONTH FROM AGE(order_month, cohort_month)) AS months_since,
      COUNT(DISTINCT user_id)::int AS active_users,
      COALESCE(SUM(order_value), 0) AS revenue
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
    cohortMap[key][`revenueMonth${Math.round(r.months_since)}`] = parseFloat((Number(r.revenue) / size).toFixed(2));
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
const getRfmSegmentation = async ({ period = '12m', _dateRange, startDate, endDate } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange, startDate, endDate });

  const rows = await db.sequelize.query(`
    WITH customer_stats AS (
      SELECT
        o.user_id,
        MAX(o.created_at) AS last_order,
        COUNT(o.id)::int AS frequency,
        SUM(o.total)::numeric AS monetary,
        EXTRACT(EPOCH FROM (:end::timestamp - MAX(o.created_at))) / 86400 AS recency_days
      FROM orders o
      WHERE o.status IN (${VALID_STATUSES_SQL})
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
    WHERE status IN (${VALID_STATUSES_SQL})
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
const getRevenueForecast = async ({ period = '90d', _dateRange, startDate, endDate } = {}) => {
  const { start, end } = getDateRange({ period, _dateRange, startDate, endDate });

  const rows = await db.sequelize.query(`
    SELECT
      created_at::date AS date,
      COALESCE(SUM(total), 0)::numeric AS revenue
    FROM orders
    WHERE status IN (${VALID_STATUSES_SQL})
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
const getDrillDown = async ({ metric, filterKey, filterValue, period = '30d', page = 1, limit = 20, startDate, endDate, _dateRange } = {}) => {
  const { start, end } = getDateRange({ period, startDate, endDate, _dateRange });
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
          WHERE o2.status IN (${VALID_STATUSES_SQL})
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
    WHERE o.status IN (${VALID_STATUSES_SQL})
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
    WHERE o.status IN (${VALID_STATUSES_SQL})
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
  resolveDateRange,
  getTopProducts,
  getProductProfitability,
  getVariantPerformance,
  getInventoryPerformance,
  getStockoutHistory,
  getAovTrend,
  getAbandonedCarts,
  getRevenueByCategory,
  getTaxReport,
  getTaxByState,
  getReturnReasons,
  getOrderStatusReport,
  getCustomerTypeSales,
  getProductReturnRates,
  getShippingPerformance,
  getSalesReconciliation,
  getRepeatCustomers,
  getRefundRate,
  getGeographicSales,
  getRevenueByPaymentMethod,
  getCustomerLifetimeValue,
  getConversionRate,
  getTrafficSources,
  getLandingPagePerformance,
  getDevicePerformance,
  getProductFunnel,
  getCheckoutFunnel,
  getUtmAttribution,
  saveCampaignSpend,
  getCouponPerformance,
  getCohortRetention,
  getRfmSegmentation,
  getOrderHeatmap,
  getRevenueForecast,
  withComparison,
  VALID_STATUSES,
  VALID_STATUSES_SQL,
};
