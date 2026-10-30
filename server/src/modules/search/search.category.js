'use strict';

// valueSql must be a bind placeholder or an already escaped SQL value.
// Expand matching categories down the tree before testing product membership.
// UNION deduplicates overlapping branches and terminates even for cyclic data.
const buildCategorySearchSql = (valueSql, { exact = false } = {}) => `EXISTS (
  WITH RECURSIVE "matching_search_categories" ("id") AS (
    SELECT "search_categories"."id"
    FROM "categories" AS "search_categories"
    WHERE LOWER("search_categories"."name") ${exact ? '=' : 'LIKE'} LOWER(${valueSql})
      OR LOWER("search_categories"."slug") ${exact ? '=' : 'LIKE'} LOWER(${valueSql})
    UNION
    SELECT "search_child"."id"
    FROM "categories" AS "search_child"
    INNER JOIN "matching_search_categories" AS "search_parent"
      ON "search_child"."parent_id" = "search_parent"."id"
  )
  SELECT 1
  FROM "product_categories" AS "search_product_categories"
  WHERE "search_product_categories"."product_id" = "Product"."id"
    AND "search_product_categories"."category_id" IN (
      SELECT "id" FROM "matching_search_categories"
    )
)`;

module.exports = { buildCategorySearchSql };
