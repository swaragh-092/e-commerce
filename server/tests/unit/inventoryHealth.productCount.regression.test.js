import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { buildInventorySummary } = require('../../src/modules/inventory/inventoryHealth.service');

describe('inventory product counts', () => {
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
