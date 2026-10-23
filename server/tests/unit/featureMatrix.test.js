import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const db = require('../../src/modules');
const {
  buildFeatures,
  TIER1_FEATURES,
  TIER2_DEFAULTS,
  isTier1Feature,
} = require('../../src/config/modes');
const {
  clearFeatureCache,
  featureGate,
  featureGateUnlessPermission,
} = require('../../src/middleware/featureGate.middleware');
const SettingsService = require('../../src/modules/settings/settings.service');
const ProductService = require('../../src/modules/product/product.service');
const { PERMISSIONS } = require('../../src/config/permissions');
const {
  isBrandVisible,
  stripBrandFields,
  assertBrandFilterAllowed,
} = require('../../src/utils/brandVisibility');

beforeEach(() => {
  clearFeatureCache();
  vi.restoreAllMocks();
});

afterEach(() => {
  clearFeatureCache();
  vi.restoreAllMocks();
});

const MODES = ['ecommerce', 'catalog'];
const TIER2_KEYS = Object.keys(TIER2_DEFAULTS.ecommerce);

// Catalog mode disables the cart backbone, so these optional features are
// forced OFF by the server cascades even when the DB tries to enable them.
const CATALOG_FORCED_OFF = new Set([
  'coupons',
  'guestCheckout',
  'requirePurchaseForReview',
  'showAvailableCoupons',
  'showPrice',
]);

const gateFor = (handler) => handler?.featureGate === true;

const collectGates = (router) => {
  const gates = [];
  router.stack.forEach((layer) => {
    if (layer.route) {
      layer.route.stack.forEach((routeLayer) => {
        if (gateFor(routeLayer.handle)) gates.push(routeLayer.handle);
      });
    } else if (gateFor(layer.handle)) {
      gates.push(layer.handle);
    }
  });
  return gates;
};

const mockFeatureState = ({ mode = 'ecommerce', overrides = {} } = {}) => {
  const rows = Object.entries(overrides).map(([key, value]) => ({
    key,
    value: value ? 'true' : 'false',
  }));
  vi.spyOn(db.Setting, 'findAll').mockResolvedValue(rows);
  vi.spyOn(db.Setting, 'findOne').mockResolvedValue({ value: mode });
};

const runGate = async (middleware, req = {}) => {
  const next = vi.fn();
  await middleware(req, {}, next);
  return next;
};

describe('Feature matrix — every feature in both modes', () => {
  describe.each(MODES)('%s mode', (mode) => {
    it('resolves the mode-locked Tier 1 backbone exactly', () => {
      const features = buildFeatures({}, mode);
      expect(features).toEqual(expect.objectContaining(TIER1_FEATURES[mode]));

      Object.entries(TIER1_FEATURES[mode]).forEach(([key, expected]) => {
        expect(features[key]).toBe(expected);
        expect(isTier1Feature(key)).toBe(true);
      });
    });

    it('cannot override Tier 1 keys from the DB in either direction', () => {
      const inverted = Object.fromEntries(
        Object.entries(TIER1_FEATURES[mode]).map(([key, value]) => [key, !value]),
      );
      const features = buildFeatures(inverted, mode);

      Object.entries(TIER1_FEATURES[mode]).forEach(([key, expected]) => {
        expect(features[key]).toBe(expected);
      });
    });

    it('exposes every optional Tier 2 key with the mode default', () => {
      const features = buildFeatures({}, mode);

      TIER2_KEYS.forEach((key) => {
        const cascadeForcedOff = mode === 'catalog' && CATALOG_FORCED_OFF.has(key);
        const expected = cascadeForcedOff ? false : TIER2_DEFAULTS[mode][key];
        expect(features).toHaveProperty(key);
        expect(features[key]).toBe(expected);
        expect(isTier1Feature(key)).toBe(false);
      });
    });

    it.each(TIER2_KEYS)('honours a DB override for "%s"', (key) => {
      const modeDefault = TIER2_DEFAULTS[mode][key];
      const override = !modeDefault;
      const features = buildFeatures({ [key]: override }, mode);

      const forcedOff = mode === 'catalog' && override === true && CATALOG_FORCED_OFF.has(key);
      expect(features[key]).toBe(forcedOff ? false : override);
    });

    it.each(TIER2_KEYS)('gates the public API for "%s" using the resolved state', async (key) => {
      clearFeatureCache();
      mockFeatureState({ mode, overrides: { [key]: false } });
      const blocked = await runGate(featureGate(key));
      expect(blocked.mock.calls[0][0]).toMatchObject({
        code: 'FEATURE_DISABLED',
        statusCode: 403,
      });

      clearFeatureCache();
      vi.restoreAllMocks();
      mockFeatureState({ mode, overrides: { [key]: true } });
      const allowed = await runGate(featureGate(key));
      // Catalog cascades may still resolve the feature to false.
      const expectedEnabled = buildFeatures({ [key]: true }, mode)[key];
      if (expectedEnabled) {
        expect(allowed).toHaveBeenCalledWith();
      } else {
        expect(allowed.mock.calls[0][0]).toMatchObject({ code: 'FEATURE_DISABLED' });
      }
    });
  });

  it('serves the resolved server state as the single source of truth', async () => {
    for (const mode of MODES) {
      vi.restoreAllMocks();
      mockFeatureState({ mode, overrides: { brands: false, reviews: false } });
      const result = await SettingsService.getFeatures();

      expect(result.mode).toBe(mode);
      expect(result.features).toEqual(buildFeatures({ brands: false, reviews: false }, mode));
      expect(result.lockedKeys).toEqual(Object.keys(TIER1_FEATURES.ecommerce));
      expect(result.features.brands).toBe(false);
      expect(result.features.reviews).toBe(false);
      expect(result.features).toEqual(expect.objectContaining(TIER1_FEATURES[mode]));
    }
  });
});

describe('Dependency cascades use the resolved feature state', () => {
  it('forces verified-purchase reviews off when reviews are off', () => {
    expect(buildFeatures({ reviews: false, requirePurchaseForReview: true }, 'ecommerce'))
      .toMatchObject({ requirePurchaseForReview: false });
  });

  it('forces available coupons off when coupons are off', () => {
    expect(buildFeatures({ coupons: false, showAvailableCoupons: true }, 'ecommerce'))
      .toMatchObject({ showAvailableCoupons: false });
  });

  it('forces cart-dependent features off in catalog mode regardless of DB values', () => {
    const features = buildFeatures({
      coupons: true,
      guestCheckout: true,
      requirePurchaseForReview: true,
      showAvailableCoupons: true,
      showPrice: true,
    }, 'catalog');

    expect(features).toMatchObject({
      coupons: false,
      guestCheckout: false,
      requirePurchaseForReview: false,
      showAvailableCoupons: false,
      showPrice: false,
    });
  });

  it('keeps brands and themes independent from cart/checkout cascades', () => {
    const catalog = buildFeatures({ brands: false, themes: false }, 'catalog');
    expect(catalog.brands).toBe(false);
    expect(catalog.themes).toBe(false);
    expect(buildFeatures({ brands: true, themes: true }, 'catalog'))
      .toMatchObject({ brands: true, themes: true });
  });
});

describe('Brands OFF — public data redaction and API access', () => {
  it('resolves brands OFF in both modes and keeps it independent', () => {
    MODES.forEach((mode) => {
      expect(buildFeatures({ brands: false }, mode).brands).toBe(false);
    });
  });

  it('isBrandVisible hides brands from customers but not staff admin views', () => {
    expect(isBrandVisible({ brands: false })).toBe(false);
    expect(isBrandVisible({ brands: false }, { adminView: true })).toBe(true);
    expect(isBrandVisible({ brands: true })).toBe(true);
    expect(isBrandVisible({}, { adminView: false })).toBe(true);
  });

  it('stripBrandFields removes brand identity recursively without mutating input', () => {
    const product = {
      id: 'prod-1',
      brandId: 'brand-1',
      brand: { id: 'brand-1', name: 'Acme' },
      categories: [{ id: 'cat-1', name: 'Shoes' }],
      variants: [{ id: 'var-1', brandId: 'brand-1', brand: { name: 'Acme' } }],
    };

    const stripped = stripBrandFields(product);

    expect(stripped.brand).toBeUndefined();
    expect(stripped.brandId).toBeUndefined();
    expect(stripped.variants[0].brand).toBeUndefined();
    expect(stripped.variants[0].brandId).toBeUndefined();
    expect(stripped.categories).toEqual(product.categories);
    expect(product.brand).toEqual({ id: 'brand-1', name: 'Acme' });
  });

  it('blocks direct customer brand filters with FEATURE_DISABLED', () => {
    let error;
    try {
      assertBrandFilterAllowed({ brands: false });
    } catch (err) {
      error = err;
    }
    expect(error).toMatchObject({ code: 'FEATURE_DISABLED', statusCode: 403 });

    expect(() => assertBrandFilterAllowed({ brands: false }, { adminView: true })).not.toThrow();
    expect(() => assertBrandFilterAllowed({ brands: true })).not.toThrow();
  });

  it('redacts brand data from public product listings but preserves staff listings', async () => {
    const mockProduct = {
      id: 'prod-1',
      name: 'Runner',
      price: 100,
      brandId: 'brand-1',
      brand: { id: 'brand-1', name: 'Acme' },
      variants: [],
    };

    vi.spyOn(db.Product, 'findAndCountAll').mockResolvedValue({ rows: [mockProduct], count: 1 });
    vi.spyOn(db.Product, 'findOne').mockResolvedValue({ min: 100, max: 100 });
    vi.spyOn(db.Product, 'findAll').mockResolvedValue([]);
    vi.spyOn(db.Product, 'count').mockResolvedValue(0);
    vi.spyOn(db.Setting, 'findOne').mockResolvedValue(null);
    vi.spyOn(SettingsService, 'getByGroup').mockResolvedValue({});

    vi.spyOn(SettingsService, 'getFeatures').mockResolvedValue({
      features: buildFeatures({ brands: false }, 'ecommerce'),
    });
    const publicResult = await ProductService.getProducts({}, 1, 10, false);
    expect(publicResult.data[0].brand).toBeUndefined();
    expect(publicResult.data[0].brandId).toBeUndefined();

    const adminResult = await ProductService.getProducts({}, 1, 10, true);
    expect(adminResult.data[0].brand).toEqual({ id: 'brand-1', name: 'Acme' });
    expect(adminResult.data[0].brandId).toBe('brand-1');
  });

  it('rejects a public ?brand= filter before querying products', async () => {
    vi.spyOn(db.Setting, 'findOne').mockResolvedValue(null);
    vi.spyOn(SettingsService, 'getFeatures').mockResolvedValue({
      features: buildFeatures({ brands: false }, 'ecommerce'),
    });
    const findAndCountAll = vi.spyOn(db.Product, 'findAndCountAll');

    await expect(ProductService.getProducts({ brand: 'acme' }, 1, 10, false))
      .rejects.toMatchObject({ code: 'FEATURE_DISABLED', statusCode: 403 });
    expect(findAndCountAll).not.toHaveBeenCalled();
  });

  it('lets customers read brands when the feature is ON', async () => {
    clearFeatureCache();
    mockFeatureState({ mode: 'ecommerce', overrides: { brands: true } });
    const next = await runGate(featureGate('brands'));
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects public brand endpoints when OFF and preserves authorized staff access', async () => {
    clearFeatureCache();
    mockFeatureState({ mode: 'ecommerce', overrides: { brands: false } });

    const customer = await runGate(featureGate('brands'));
    expect(customer.mock.calls[0][0]).toMatchObject({ code: 'FEATURE_DISABLED', statusCode: 403 });

    const staffGate = featureGateUnlessPermission('brands', PERMISSIONS.BRANDS_READ);
    const staff = await runGate(staffGate, {
      user: { id: 'staff-1', role: 'admin', roles: ['admin'] },
    });
    expect(staff).toHaveBeenCalledWith();

    const unrelated = await runGate(
      featureGateUnlessPermission('brands', PERMISSIONS.BRANDS_READ),
      { user: { id: 'cust-1', role: 'customer', roles: ['customer'] } },
    );
    expect(unrelated.mock.calls[0][0]).toMatchObject({ code: 'FEATURE_DISABLED' });
  });

  it('wires the public brand routes behind the brands gate and leaves staff CRUD ungated', () => {
    const brandRoutes = require('../../src/modules/brand/brand.routes');
    const gates = collectGates(brandRoutes);

    expect(gates.length).toBeGreaterThanOrEqual(2);
    gates.forEach((gate) => {
      expect(gate.featureKey).toBe('brands');
      expect(gate.bypassPermissions).toEqual(expect.arrayContaining([PERMISSIONS.BRANDS_READ]));
    });

    const writeRoutes = brandRoutes.stack.filter(
      (layer) => layer.route && ['post', 'patch', 'delete'].some((method) => layer.route.methods[method]),
    );
    expect(writeRoutes).toHaveLength(3);
    writeRoutes.forEach((layer) => {
      const hasGate = layer.route.stack.some((routeLayer) => gateFor(routeLayer.handle));
      expect(hasGate).toBe(false);
    });
  });
});

describe('Themes, SEO, API Builder, and other feature UI/API agreement', () => {
  const WIRING = [
    { path: '../../src/modules/theme/theme.routes', key: 'themes' },
    { path: '../../src/modules/seo/seo.routes', key: 'seo' },
    { path: '../../src/modules/apiBuilder/apiBuilder.routes', key: 'apiBuilder' },
    { path: '../../src/modules/productAssistant/productAssistant.routes', key: 'productAssistant' },
    { path: '../../src/modules/wishlist/wishlist.routes', key: 'wishlist' },
    { path: '../../src/modules/cart/cart.routes', key: 'cart' },
    { path: '../../src/modules/shipping/shipping.routes', key: 'shipping' },
    { path: '../../src/modules/review/review.routes', key: 'reviews' },
    { path: '../../src/modules/order/order.routes', key: 'orders' },
  ];

  it.each(WIRING)('gates $key routes behind the $key feature', ({ path, key }) => {
    const router = require(path);
    const gates = collectGates(router);
    expect(gates.some((gate) => gate.featureKey === key)).toBe(true);
  });

  it('gates every theme route so Themes OFF is consistent across UI and API', () => {
    const themeRoutes = require('../../src/modules/theme/theme.routes');
    const routeLayers = themeRoutes.stack.filter((layer) => layer.route);

    expect(routeLayers.length).toBeGreaterThan(0);
    routeLayers.forEach((layer) => {
      const hasThemeGate = layer.route.stack.some(
        (routeLayer) => gateFor(routeLayer.handle) && routeLayer.handle.featureKey === 'themes',
      );
      expect(hasThemeGate).toBe(true);
    });
  });

  it('gates public enquiry submissions while leaving the staff inbox ungated', () => {
    const enquiryRoutes = require('../../src/modules/enquiry/enquiry.routes');
    const enquiryAdminRoutes = require('../../src/modules/enquiry/enquiry.admin.routes');

    expect(collectGates(enquiryRoutes).some((gate) => gate.featureKey === 'enquiry')).toBe(true);
    expect(collectGates(enquiryAdminRoutes)).toHaveLength(0);
  });

  it('gates public coupons while leaving staff coupon management ungated', () => {
    const couponRoutes = require('../../src/modules/coupon/coupon.routes');
    const gates = collectGates(couponRoutes);

    expect(gates.some((gate) => gate.featureKey === 'coupons')).toBe(true);
    expect(gates.some((gate) => gate.featureKey === 'showAvailableCoupons')).toBe(true);
    expect(gates.every((gate) => gate.bypassPermissions === undefined)).toBe(true);
  });

  it('gates public reviews while leaving staff moderation ungated', () => {
    const reviewRoutes = require('../../src/modules/review/review.routes');
    const reviewAdminRoutes = require('../../src/modules/review/review.admin.routes');

    expect(collectGates(reviewRoutes).some((gate) => gate.featureKey === 'reviews')).toBe(true);
    expect(collectGates(reviewAdminRoutes)).toHaveLength(0);
  });

  it('rejects theme API access for customers in both modes when OFF', async () => {
    for (const mode of MODES) {
      clearFeatureCache();
      vi.restoreAllMocks();
      mockFeatureState({ mode, overrides: { themes: false } });
      const next = await runGate(featureGate('themes'));
      expect(next.mock.calls[0][0]).toMatchObject({ code: 'FEATURE_DISABLED', statusCode: 403 });
    }
  });
});

describe('Unimplemented optional keys are not treated as working features', () => {
  it('keeps multiCurrency and socialLogin at their resolved (default OFF) values', () => {
    MODES.forEach((mode) => {
      const features = buildFeatures({ multiCurrency: true, socialLogin: true }, mode);
      // These keys exist for forward-compatibility only. No server code consumes
      // them, and no UI switch is exposed, so the matrix records their presence
      // without claiming working behaviour.
      expect(features).toHaveProperty('multiCurrency');
      expect(features).toHaveProperty('socialLogin');
      expect(TIER2_DEFAULTS[mode].multiCurrency).toBe(false);
      expect(TIER2_DEFAULTS[mode].socialLogin).toBe(false);
    });
  });
});
