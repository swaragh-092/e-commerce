import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const { getCatalogOverview } = require('../../src/modules/admin/catalogAnalytics.service');
const router = require('../../src/modules/admin/admin.routes');
const { buildFeatures } = require('../../src/config/modes');
const { clearFeatureCache } = require('../../src/middleware/featureGate.middleware');
const { catalogAnalyticsQuerySchema } = require('../../src/modules/admin/admin.validation');

afterEach(() => { vi.restoreAllMocks(); clearFeatureCache(); });

describe('Catalog analytics', () => {
  it('limits report requests to the supported time ranges', () => {
    expect(catalogAnalyticsQuerySchema.validate({ period: '999999m' }).error).toBeDefined();
    expect(catalogAnalyticsQuerySchema.validate({ period: '30d' }).error).toBeUndefined();
  });
  it('is optional in both modes without enabling orders', () => {
    expect(buildFeatures({}, 'catalog')).toMatchObject({ analytics: true, orders: false });
    expect(buildFeatures({ analytics: false }, 'catalog').analytics).toBe(false);
    expect(buildFeatures({}, 'ecommerce').analytics).toBe(true);
  });

  it('allows Dashboard-only staff to read catalog reports while protecting sales reports', () => {
    const req = { user: { permissions: ['dashboard.view'] } };
    const overview = router.stack.find(({ route }) => route?.path === '/analytics/catalog-overview').route;
    const sales = router.stack.find(({ route }) => route?.path === '/analytics/top-products').route;
    const next = vi.fn();
    overview.stack[1].handle(req, {}, next);
    expect(next).toHaveBeenCalledWith();
    next.mockClear();
    sales.stack[1].handle(req, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('rejects analytics requests when the platform switch is off', async () => {
    vi.spyOn(db.Setting, 'findAll').mockResolvedValue([{ key: 'analytics', value: false }]);
    vi.spyOn(db.Setting, 'findOne').mockResolvedValue({ value: 'catalog' });
    const gate = router.stack.find((layer) => !layer.route && layer.name === 'gate' && layer.regexp.test('/analytics/catalog-overview'));
    const next = vi.fn();
    await gate.handle({}, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FEATURE_DISABLED' }));
  });

  it('uses bounded traffic queries with no order or customer records', async () => {
    const query = vi.spyOn(db.sequelize, 'query').mockResolvedValueOnce([{ t: 'page_visits' }])
      .mockResolvedValueOnce([{ visits: 12, sessions: 4, productViews: 8, trend: [], topViews: [], trafficSources: [], campaigns: [] }]);
    expect(await getCatalogOverview({ period: '7d' })).toMatchObject({ visits: 12, sessions: 4, trackingAvailable: true });
    const [sql, options] = query.mock.calls[1];
    expect(sql).toContain('created_at BETWEEN :start AND :end');
    expect(sql).not.toMatch(/\b(orders|order_items|users|user_profiles)\b/);
    expect(options.replacements.start).toBeInstanceOf(Date);
    expect(options.replacements.end - options.replacements.start).toBe(7 * 864e5);
  });

  it('returns an explicit unavailable state before tracking is installed', async () => {
    const query = vi.spyOn(db.sequelize, 'query').mockResolvedValueOnce([{ t: null }]);
    expect(await getCatalogOverview()).toMatchObject({ visits: 0, topViews: [], trackingAvailable: false });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
