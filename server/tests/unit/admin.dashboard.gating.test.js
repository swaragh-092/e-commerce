import { createRequire } from 'node:module';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const adminRouter = require('../../src/modules/admin/admin.routes');
const adminController = require('../../src/modules/admin/admin.controller');
const { clearFeatureCache } = require('../../src/middleware/featureGate.middleware');

beforeEach(() => {
  clearFeatureCache();
});

afterEach(() => {
  clearFeatureCache();
  vi.restoreAllMocks();
});

describe('Admin route feature gating', () => {
  it('gates order-dependent dashboard and analytics endpoints', () => {
    const routes = adminRouter.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        method: Object.keys(layer.route.methods)[0],
        middlewareCount: layer.route.stack.length,
        stack: layer.route.stack,
      }));

    const salesChartRoute = routes.find((r) => r.path === '/dashboard/sales-chart');
    const recentOrdersRoute = routes.find((r) => r.path === '/dashboard/recent-orders');
    const statsRoute = routes.find((r) => r.path === '/dashboard/stats');
    const lowStockRoute = routes.find((r) => r.path === '/dashboard/low-stock');
    const topProductsRoute = routes.find((r) => r.path === '/analytics/top-products');
    const aovTrendRoute = routes.find((r) => r.path === '/analytics/aov-trend');
    const couponPerformanceRoute = routes.find((r) => r.path === '/analytics/coupon-performance');
    const exportRoute = routes.find((r) => r.path === '/analytics/export/:metric');

    expect(salesChartRoute).toBeDefined();
    expect(recentOrdersRoute).toBeDefined();
    expect(statsRoute).toBeDefined();
    expect(lowStockRoute).toBeDefined();
    expect(topProductsRoute).toBeDefined();
    expect(aovTrendRoute).toBeDefined();
    expect(couponPerformanceRoute).toBeDefined();
    expect(exportRoute).toBeDefined();

    // sales-chart has adminOnly (2), ordersFeature (1), validate (1), controller (1) = 5
    expect(salesChartRoute.middlewareCount).toBe(5);
    // recent-orders has adminOnly (2), ordersFeature (1), controller (1) = 4
    expect(recentOrdersRoute.middlewareCount).toBe(4);
    // stats has adminOnly (2), controller (1) = 3 (feature-aware payload in service)
    expect(statsRoute.middlewareCount).toBe(3);
    // top-products has adminOnly (2), validate (1), controller (1) = 4 (ungated for catalog)
    expect(topProductsRoute.middlewareCount).toBe(4);
    // aov-trend has adminOnly (2), ordersFeature (1), validate (1), controller (1) = 5
    expect(aovTrendRoute.middlewareCount).toBe(5);
    // coupon-performance has adminOnly (2), ordersFeature (1), couponsFeature (1), validate (1), controller (1) = 6
    expect(couponPerformanceRoute.middlewareCount).toBe(6);
    // export route has adminOnly (2), ordersFeature (1), exportMetricFeatureGate (1), controller (1) = 5
    expect(exportRoute.middlewareCount).toBe(5);
  });

  it('gates coupon CSV exports when coupons feature is disabled', async () => {
    vi.spyOn(db.Setting, 'findAll').mockResolvedValue([
      { key: 'orders', value: true },
      { key: 'coupons', value: false },
    ]);
    vi.spyOn(db.Setting, 'findOne').mockResolvedValue({ value: 'ecommerce' });

    const routes = adminRouter.stack
      .filter((layer) => layer.route)
      .map((layer) => ({ path: layer.route.path, stack: layer.route.stack }));

    const exportRoute = routes.find((r) => r.path === '/analytics/export/:metric');
    const exportMetricGate = exportRoute.stack[exportRoute.stack.length - 2].handle;

    const req = { params: { metric: 'coupon-performance' } };
    const res = {};
    const next = vi.fn();

    await exportMetricGate(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'FEATURE_DISABLED',
        statusCode: 403,
      })
    );

    // Controller also fails closed when called directly
    const nextController = vi.fn();
    await adminController.exportAnalyticsCsv(req, res, nextController);
    expect(nextController).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'FEATURE_DISABLED',
        statusCode: 403,
      })
    );
  });

  it('allows non-coupon exports past the metric gate', async () => {
    const routes = adminRouter.stack
      .filter((layer) => layer.route)
      .map((layer) => ({ path: layer.route.path, stack: layer.route.stack }));

    const exportRoute = routes.find((r) => r.path === '/analytics/export/:metric');
    const exportMetricGate = exportRoute.stack[exportRoute.stack.length - 2].handle;

    const req = { params: { metric: 'top-products' } };
    const res = {};
    const next = vi.fn();

    await exportMetricGate(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });
});
