import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { buildInventorySummary } = require('../../src/modules/inventory/inventoryHealth.service');

describe('inventory product counts', () => {
  it('counts each inventory record once and does not report the parent SKU for a variant', () => {
    const variant = { id: 'variant-with-sku', sku: 'YQ112', stockQty: 4 };
    const summary = buildInventorySummary([{
      id: 'yellow-queen',
      name: 'YELLOW QUEEN',
      sku: 'YQ112',
      type: 'variable',
      status: 'published',
      variants: [variant, { ...variant }, { id: 'variant-without-sku', stockQty: 4 }],
    }], 10);

    expect(summary.rows).toMatchObject([
      { variantId: 'variant-with-sku', sku: 'YQ112', availableQty: 4 },
      { variantId: 'variant-without-sku', sku: '', availableQty: 4 },
    ]);
    expect(summary.totalAtRisk).toBe(2);
    expect(summary.lowStockCount).toBe(2);
    expect(summary.atRiskProductCount).toBe(1);
  });

  it('counts a product once when multiple variants are at risk', () => {
    const summary = buildInventorySummary([{
      id: 'variable-product',
      type: 'variable',
      status: 'published',
      isEnabled: true,
      variants: [
        { id: 'low-1', stockQty: 4, reservedQty: 0, isActive: true },
        { id: 'low-2', stockQty: 5, reservedQty: 0, isActive: true },
      ],
    }], 10);

    expect(summary.totalAtRisk).toBe(2);
    expect(summary.atRiskProductCount).toBe(1);
  });
});
