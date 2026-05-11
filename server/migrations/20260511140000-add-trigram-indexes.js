'use strict';

/**
 * Migration: Add trigram GIN indexes for fuzzy text search.
 *
 * These indexes support the similarity() function and the % (trigram
 * similarity) operator used by the typo-tolerant search fallback.
 *
 * Tables covered:
 * - products.name  → product name fuzzy search
 * - products.sku   → SKU partial/typo search
 * - brands.name    → brand name fuzzy search (for multi-entity search)
 * - categories.name → category name fuzzy search (for multi-entity search)
 */

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_products_name_trgm
        ON products USING GIN (name gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS idx_products_sku_trgm
        ON products USING GIN (sku gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS idx_brands_name_trgm
        ON brands USING GIN (name gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS idx_categories_name_trgm
        ON categories USING GIN (name gin_trgm_ops);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_products_name_trgm;
      DROP INDEX IF EXISTS idx_products_sku_trgm;
      DROP INDEX IF EXISTS idx_brands_name_trgm;
      DROP INDEX IF EXISTS idx_categories_name_trgm;
    `);
  },
};
