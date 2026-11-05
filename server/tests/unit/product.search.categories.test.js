import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const productService = require('../../src/modules/product/product.service');
const SettingsService = require('../../src/modules/settings/settings.service');
const { buildCategorySearchSql } = require('../../src/modules/search/search.category');
const { buildSearchPattern } = require('../../src/modules/search/search.utils');

afterEach(() => vi.restoreAllMocks());

describe('category hierarchy product search', () => {
  it('expands matching categories recursively and deduplicates overlapping branches', () => {
    const sql = buildCategorySearchSql('$queryPattern');
    expect(sql).toContain('WITH RECURSIVE');
    expect(sql).toContain('"search_child"."parent_id" = "search_parent"."id"');
    expect(sql).toContain('"search_product_categories"."category_id" IN');
    expect(sql).toContain('"search_product_categories"."product_id" = "Product"."id"');
    expect(sql).toContain('\n    UNION\n');
    expect(sql).not.toContain('UNION ALL');
  });

  it('keeps bind parameters for exact category relevance and partial category matches', () => {
    expect(buildCategorySearchSql('$queryText', { exact: true })).toContain('LOWER("search_categories"."name") = LOWER($queryText)');
    expect(buildCategorySearchSql('$queryPattern')).toContain('LOWER("search_categories"."slug") LIKE LOWER($queryPattern)');
  });

  it('uses escaped category matching in product lists without changing publication or paging', async () => {
    vi.spyOn(SettingsService, 'getFeatures').mockResolvedValue({ features: {} });
    vi.spyOn(db.Setting, 'findOne').mockResolvedValue(null);
    vi.spyOn(db.Product, 'findAndCountAll').mockRejectedValue(new Error('query captured'));
    const term = "Farmer's 20%_seed";
    await expect(productService.getProducts({ search: term }, 2, 6)).rejects.toThrow('query captured');
    const query = db.Product.findAndCountAll.mock.calls[0][0];
    expect(query.where).toMatchObject({ status: 'published', isEnabled: true });
    expect(query.limit).toBe(6);
    expect(query.offset).toBe(6);
    expect(query.where[db.Sequelize.Op.or].some(condition => condition.val === buildCategorySearchSql(db.sequelize.escape(buildSearchPattern(term))))).toBe(true);
    expect(query.where[db.Sequelize.Op.or].some(condition => condition.sku)).toBe(true);
  });
});
