import { describe, expect, it } from 'vitest';
import { getProductDetailsOrder } from '../../../utils/productDetailsOrder';

describe('product details layout', () => {
  const heroBlocks = [
    { id: 'care', productPlacement: 'after-details' },
    { id: 'delivery', productPlacement: 'before-options' },
    { id: 'note' },
  ];

  it('keeps previously saved placement slots as the initial Details order', () => {
    expect(getProductDetailsOrder({ heroBlocks })).toEqual([
      'title', 'metadata', 'price', 'summary', 'custom:delivery', 'variants', 'purchase',
      'custom:note', 'specifications', 'description', 'custom:care',
    ]);
  });

  it('keeps the saved sequence, skips removed blocks, and retains the purchase controls', () => {
    const order = getProductDetailsOrder({ heroBlocks, detailsBlockOrder: ['description', 'custom:removed', 'custom:note', 'description'] });
    expect(order.slice(0, 2)).toEqual(['description', 'custom:note']);
    expect(order).not.toContain('custom:removed');
    expect(order.filter((key) => key === 'purchase' || key === 'variants')).toEqual(['variants', 'purchase']);
  });
});
