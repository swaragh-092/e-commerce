import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const SearchRepository = require('../../src/modules/search/search.repository');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('search relevance', () => {
  it('matches exact categories and includes partial category matching in relevance', () => {
    const exactSql = SearchRepository.categoryMatchSql();
    const relevanceSql = SearchRepository.buildRelevanceSql('similarity("Product"."name", $queryText)');

    expect(exactSql).toContain('"product_categories"');
    expect(exactSql).toContain('LOWER("search_categories"."name") = LOWER($queryText)');
    expect(exactSql).toContain('LOWER("search_categories"."slug") = LOWER($queryText)');
    expect(relevanceSql).toContain('LOWER("search_categories"."name") LIKE LOWER($queryPattern)');
    expect(relevanceSql).toContain('LOWER("search_categories"."slug") LIKE LOWER($queryPattern)');
  });

  it('ranks exact category, exact brand, and exact product matches ahead of fuzzy relevance', () => {
    const sql = SearchRepository.buildRelevanceSql('similarity("Product"."name", $queryText)');

    expect(sql.indexOf('THEN 100000 ELSE')).toBeLessThan(sql.indexOf('THEN 90000 ELSE'));
    expect(sql.indexOf('THEN 90000 ELSE')).toBeLessThan(sql.indexOf('THEN 10000 ELSE'));
    expect(sql).toContain('THEN 9000 ELSE');
    expect(sql).toContain('THEN 1000 ELSE');
  });
});

describe('brand visibility', () => {
  it('omits brand SQL when brands are hidden', () => {
    const sql = SearchRepository.buildRelevanceSql('0', { includeBrands: false });

    expect(sql).not.toContain('"brands"');
    expect(sql).not.toContain('90000');
    expect(sql).not.toContain('400');
    expect(SearchRepository.buildRelevanceSql('0')).toContain('"brands"');
  });

  it('omits the brand include and brand matching from product queries', async () => {
    vi.spyOn(db.Product, 'findAndCountAll').mockResolvedValue({
      rows: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }],
      count: 4,
    });

    await SearchRepository.searchProducts('acme', 10, 0, { includeBrands: false });

    const options = db.Product.findAndCountAll.mock.calls[0][0];
    expect(options.include.map((entry) => entry.as)).not.toContain('brand');
    expect(options.where[db.Sequelize.Op.and][0].val).not.toContain('"brands"');
  });
});
