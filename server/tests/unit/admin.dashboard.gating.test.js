import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const adminRouter = require('../../src/modules/admin/admin.routes');

describe('Admin route feature gating', () => {
  it('gates order-dependent dashboard and analytics endpoints', () => {
    const routes = adminRouter.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        method: Object.keys(layer.route.methods)[0],
        middlewareCount: layer.route.stack.length,
      }));

    const salesChartRoute = routes.find((r) => r.path === '/dashboard/sales-chart');
    const recentOrdersRoute = routes.find((r) => r.path === '/dashboard/recent-orders');
    const statsRoute = routes.find((r) => r.path === '/dashboard/stats');
    const lowStockRoute = routes.find((r) => r.path === '/dashboard/low-stock');
    const topProductsRoute = routes.find((r) => r.path === '/analytics/top-products');
    const aovTrendRoute = routes.find((r) => r.path === '/analytics/aov-trend');
    const couponPerformanceRoute = routes.find((r) => r.path === '/analytics/coupon-performance');

    expect(salesChartRoute).toBeDefined();
    expect(recentOrdersRoute).toBeDefined();
    expect(statsRoute).toBeDefined();
    expect(lowStockRoute).toBeDefined();
    expect(topProductsRoute).toBeDefined();
    expect(aovTrendRoute).toBeDefined();
    expect(couponPerformanceRoute).toBeDefined();

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
  });
});
