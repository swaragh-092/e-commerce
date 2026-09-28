import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildInventorySummary, getStats } from '../../src/modules/admin/admin.service';
import { normalizeInventoryThreshold } from '../../src/modules/inventory/inventoryHealth.service';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const SettingsService = require('../../src/modules/settings/settings.service');

afterEach(() => vi.restoreAllMocks());

describe('Admin inventory health', () => {
  it('uses the default only for missing thresholds while preserving explicit zero', () => {
    expect(normalizeInventoryThreshold(undefined)).toBe(10);
    expect(normalizeInventoryThreshold(null)).toBe(10);
    expect(normalizeInventoryThreshold('')).toBe(10);
    expect(normalizeInventoryThreshold(0)).toBe(0);
  });

  it('classifies available stock using active variant totals', () => {
    const summary = buildInventorySummary([
      {
        id: 'simple-low',
        name: 'Simple low',
        quantity: 8,
        reservedQty: 2,
        status: 'published',
        isEnabled: true,
        variants: [],
      },
      {
        id: 'variant-out',
        name: 'Variant out',
        quantity: 99,
        reservedQty: 0,
        status: 'published',
        isEnabled: true,
        variants: [
          { stockQty: 2, reservedQty: 2, isActive: true },
          { stockQty: 50, reservedQty: 50, isActive: false },
        ],
      },
      {
        id: 'threshold-low',
        name: 'At threshold',
        quantity: 10,
        reservedQty: 0,
        status: 'published',
        isEnabled: true,
        variants: [],
      },
      {
        id: 'healthy',
        name: 'Healthy',
        quantity: 40,
        reservedQty: 0,
        status: 'published',
        isEnabled: true,
        variants: [],
      },
    ], 10);

    expect(summary.lowStockCount).toBe(2);
    expect(summary.outOfStockCount).toBe(1);
    expect(summary.totalAtRisk).toBe(3);
    expect(summary.rows.map((row) => row.status)).toEqual(['out_of_stock', 'low_stock', 'low_stock']);
    expect(summary.rows[0].availableQty).toBe(0);
    expect(summary.rows[1].availableQty).toBe(6);
    expect(summary.rows[2].availableQty).toBe(10);
  });

  it('does not count drafts or disabled products as customer-facing inventory risk', () => {
    const summary = buildInventorySummary([
      { id: 'draft', status: 'draft', isEnabled: true, quantity: 0, reservedQty: 0, variants: [] },
      { id: 'disabled', status: 'published', isEnabled: false, quantity: 0, reservedQty: 0, variants: [] },
    ], 10);

    expect(summary.totalAtRisk).toBe(0);
    expect(summary.rows).toHaveLength(0);
  });

  it('counts active variants separately and ignores inactive or unsellable variants', () => {
    const summary = buildInventorySummary([
      {
        id: 'variable-product',
        type: 'variable',
        name: 'Seed pack',
        status: 'published',
        isEnabled: true,
        variants: [
          { id: 'variant-low', sku: 'SEED-LOW', stockQty: 12, reservedQty: 3, isActive: true },
          { id: 'variant-out', sku: 'SEED-OUT', stockQty: 4, reservedQty: 4, isActive: true },
          { id: 'variant-disabled', sku: 'SEED-OFF', stockQty: 0, reservedQty: 0, isActive: false },
        ],
      },
      { id: 'empty-variable', type: 'variable', status: 'published', isEnabled: true, variants: [] },
    ], 10);

    expect(summary.totalAtRisk).toBe(2);
    expect(summary.lowStockCount).toBe(1);
    expect(summary.outOfStockCount).toBe(1);
    expect(summary.rows.map((row) => row.inventoryKey)).toEqual(['variant:variant-out', 'variant:variant-low']);
    expect(summary.rows.map((row) => row.availableQty)).toEqual([0, 9]);
  });
});


describe('Admin dashboard product count', () => {
  it('counts only storefront-visible published products', async () => {
    vi.spyOn(SettingsService, 'getByGroup').mockResolvedValue({ lowStockThreshold: 10 });
    vi.spyOn(db.Order, 'findOne').mockResolvedValue({ totalRevenue: '0' });
    vi.spyOn(db.Order, 'count').mockResolvedValue(0);
    vi.spyOn(db.User, 'count').mockResolvedValue(0);
    vi.spyOn(db.Product, 'count').mockResolvedValue(3);
    vi.spyOn(db.Product, 'findAll').mockResolvedValue([]);
    vi.spyOn(db.Review, 'count').mockResolvedValue(0);

    const stats = await getStats();

    expect(stats.productCount).toBe(3);
    expect(db.Product.count).toHaveBeenCalledWith({
      where: { status: 'published', isEnabled: true },
    });
  });
});
