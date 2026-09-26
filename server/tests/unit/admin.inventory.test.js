import { describe, expect, it } from 'vitest';
import { buildInventorySummary } from '../../src/modules/admin/admin.service';

describe('Admin inventory health', () => {
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
});
