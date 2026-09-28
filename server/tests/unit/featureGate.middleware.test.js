import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const {
  buildFeatures,
  isTier1Feature,
} = require('../../src/config/modes');
const {
  clearFeatureCache,
  featureGate,
  invalidateFeature,
} = require('../../src/middleware/featureGate.middleware');

const runGate = async (featureKey) => {
  const next = vi.fn();
  await featureGate(featureKey)({}, {}, next);
  return next;
};

describe('Feature mode resolution', () => {
  it('keeps Tier 1 ecommerce features enabled even when DB values try to disable them', () => {
    const features = buildFeatures({ checkout: false, orders: false }, 'ecommerce');

    expect(features.checkout).toBe(true);
    expect(features.orders).toBe(true);
    expect(isTier1Feature('checkout')).toBe(true);
  });

  it('keeps Tier 1 catalog features disabled even when DB values try to enable them', () => {
    const features = buildFeatures({ checkout: true, orders: true }, 'catalog');

    expect(features.checkout).toBe(false);
    expect(features.orders).toBe(false);
  });

  it('allows Tier 2 feature values to override mode defaults', () => {
    expect(buildFeatures({ enquiry: true, brands: false }, 'ecommerce')).toEqual(
      expect.objectContaining({ enquiry: true, brands: false }),
    );
  });
});

describe('featureGate middleware', () => {
  let featureRows;

  beforeEach(() => {
    clearFeatureCache();
    featureRows = [];
    vi.spyOn(db.Setting, 'findAll').mockImplementation(async () => featureRows);
    vi.spyOn(db.Setting, 'findOne').mockResolvedValue({ value: 'ecommerce' });
  });

  afterEach(() => {
    clearFeatureCache();
    vi.restoreAllMocks();
  });

  it('fails closed with FEATURE_DISABLED when a feature resolves false', async () => {
    featureRows = [{ key: 'enquiry', value: 'false' }];

    const next = await runGate('enquiry');
    const error = next.mock.calls[0][0];

    expect(error).toMatchObject({
      code: 'FEATURE_DISABLED',
      statusCode: 403,
    });
  });

  it('allows a request when a feature resolves true', async () => {
    featureRows = [{ key: 'brands', value: 'true' }];

    const next = await runGate('brands');

    expect(next).toHaveBeenCalledWith();
  });

  it('uses cached values until the feature is explicitly invalidated', async () => {
    featureRows = [{ key: 'brands', value: 'false' }];
    const blocked = await runGate('brands');
    expect(blocked.mock.calls[0][0]?.code).toBe('FEATURE_DISABLED');

    featureRows = [{ key: 'brands', value: 'true' }];
    const stillBlocked = await runGate('brands');
    expect(stillBlocked.mock.calls[0][0]?.code).toBe('FEATURE_DISABLED');

    invalidateFeature('brands');
    const allowed = await runGate('brands');
    expect(allowed).toHaveBeenCalledWith();
  });
});
