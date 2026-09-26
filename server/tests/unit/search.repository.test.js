import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const SearchRepository = require('../../src/modules/search/search.repository');

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
