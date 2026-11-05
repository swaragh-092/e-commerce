import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const { buildInventorySummary } = require('../../src/modules/inventory/inventoryHealth.service');
const { buildInventoryTargets } = require('../../src/modules/inventory/inventoryAlert.service');

const product = { id: 'product', name: 'IGA', type: 'simple', status: 'published', isEnabled: true, quantity: 99, variants: [
  { id: 'low', sku: 'IGA-250G', stockQty: 22, reservedQty: 19, isActive: true },
  { id: 'healthy', sku: 'IGA-500G', stockQty: 50, reservedQty: 0, isActive: true },
  { id: 'disabled', sku: 'IGA-1KG', stockQty: 4, reservedQty: 4, isActive: false },
] };

describe('inventory availability and disable rules', () => {
  it('uses the same per-SKU risk for dashboard and notifications regardless of parent totals', () => {
    const summary = buildInventorySummary([product], 10);
    const alerts = buildInventoryTargets([product], 10);
    expect(summary.rows).toHaveLength(1);
    expect(alerts).toHaveLength(1);
    expect(summary.rows[0]).toMatchObject({ inventoryKey: 'variant:low', sku: 'IGA-250G', quantity: 22, reservedQty: 19, availableQty: 3 });
    expect(alerts[0]).toMatchObject({ inventoryKey: 'variant:low', availableQty: 3, severity: 'low_stock' });
  });
  it('removes disabled products from risk and restores alerts on re-enable without changing reservations', () => {
    const disabled = { ...product, isEnabled: false };
    expect(buildInventorySummary([disabled], 10).totalAtRisk).toBe(0);
    expect(buildInventoryTargets([disabled], 10)).toEqual([]);
    expect(buildInventoryTargets([{ ...disabled, isEnabled: true }], 10)[0].availableQty).toBe(3);
    expect(product.variants[0].reservedQty).toBe(19);
  });
  it('never falls back to parent quantity when every variant is disabled', () => {
    const disabled = { ...product, variants: product.variants.map((row) => ({ ...row, isActive: false })) };
    expect(buildInventorySummary([disabled], 10).rows).toEqual([]);
    expect(buildInventoryTargets([disabled], 10)).toEqual([]);
  });
  it.each([[0, 'out_of_stock'], [3, 'low_stock'], [10, 'low_stock'], [11, null]])('classifies %s available units at threshold ten', (availableQty, severity) => {
    const simple = { ...product, variants: [], quantity: availableQty + 2, reservedQty: 2 };
    const targets = buildInventoryTargets([simple], 10);
    if (severity) expect(targets[0]).toMatchObject({ availableQty, severity });
    else expect(targets).toEqual([]);
  });
  it('supports a zero threshold and all-reserved stock', () => {
    expect(buildInventoryTargets([{ ...product, variants: [], quantity: 4, reservedQty: 4 }], 0)[0].severity).toBe('out_of_stock');
    expect(buildInventoryTargets([{ ...product, variants: [], quantity: 4, reservedQty: 3 }], 0)).toEqual([]);
  });
});
