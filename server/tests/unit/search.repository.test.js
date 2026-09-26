import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const SearchRepository = require('../../src/modules/search/search.repository');

describe('search relevance', () => {
  it('matches product categories by exact name or slug', () => {
    const sql = SearchRepository.categoryMatchSql();

    expect(sql).toContain('"product_categories"');
    expect(sql).toContain('LOWER("search_categories"."name") = LOWER($queryText)');
    expect(sql).toContain('LOWER("search_categories"."slug") = LOWER($queryText)');
  });

  it('puts exact category and product matches ahead of fuzzy relevance', () => {
    const sql = SearchRepository.buildRelevanceSql('similarity("Product"."name", $queryText)');

    expect(sql.indexOf('THEN 100000 ELSE')).toBeLessThan(sql.indexOf('THEN 10000 ELSE'));
    expect(sql).toContain('THEN 9000');
    expect(sql).toContain('THEN 1000');
  });
});
