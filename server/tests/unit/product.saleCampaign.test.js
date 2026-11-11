import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Product, Sequelize } = require('../../src/modules');
const settings = require('../../src/modules/settings/settings.service');
const labels = require('../../src/modules/settings/saleLabel.service');

describe('public sale campaign filtering', () => {
  afterEach(() => vi.restoreAllMocks());

  it('combines the exact label with public visibility and active sale conditions', async () => {
    vi.spyOn(labels, 'getSaleLabels').mockResolvedValue([{ id: 'summer-sale', isActive: true }]);
    vi.spyOn(settings, 'getFeatures').mockResolvedValue({ features: { pricing: true } });
    const find = vi.spyOn(Product, 'findAndCountAll').mockResolvedValue({ rows: [], count: 0 });
    vi.spyOn(Product, 'findOne').mockResolvedValue({ min: 0, max: 0 });
    const products = require('../../src/modules/product/product.service');

    await products.getProducts({ saleLabel: 'summer-sale' }, 1, 8);
    const [{ where }] = find.mock.calls[0];
    expect(where).toMatchObject({ saleLabel: 'summer-sale', isEnabled: true, status: 'published' });
    expect(where[Sequelize.Op.and][0].val).toContain('"sale_price" < "Product"."price"');
    expect(where[Sequelize.Op.and][0].val).toContain('"sale_end_at" >= NOW()');

    await products.getProducts({ saleLabel: 'deleted-sale' }, 1, 8);
    expect(find.mock.calls[1][0].where[Sequelize.Op.and][0].val).toBe('FALSE');
  });
});
