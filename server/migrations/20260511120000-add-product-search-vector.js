'use strict';

/**
 * Migration: Add PostgreSQL Full-Text Search to products
 *
 * WHY tsvector + GIN instead of LIKE/ILIKE:
 * - ILIKE '%query%' does a sequential scan on every row — O(n) and cannot use indexes.
 * - tsvector pre-processes text into searchable lexemes at write-time, so reads are O(log n).
 * - GIN index makes the @@ operator sub-millisecond even on 100K+ rows.
 * - ts_rank() provides relevance ordering — higher weight for name matches vs description.
 *
 * WHY 'simple' language config:
 * - 'english' stemmer can be too aggressive for product names (e.g. "running" → "run").
 * - 'simple' tokenizes on whitespace/punctuation without stemming, which is better
 *   for exact product name matching in e-commerce catalogs.
 *
 * WHY a trigger instead of application-level updates:
 * - Guarantees the search_vector is ALWAYS in sync, even if data is modified
 *   via raw SQL, migrations, or seeders — not just through Sequelize.
 * - Zero application code needed to maintain the column.
 */

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      -- 1. Add the search vector column
      ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector;

      -- 2. Create the trigger function
      --    Weights: name=A (highest), short_description=B
      CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
          setweight(to_tsvector('simple', COALESCE(NEW.short_description, '')), 'B');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- 3. Create the trigger (fires on name or short_description changes)
      DROP TRIGGER IF EXISTS trg_products_search_vector ON products;
      CREATE TRIGGER trg_products_search_vector
        BEFORE INSERT OR UPDATE OF name, short_description
        ON products
        FOR EACH ROW
        EXECUTE FUNCTION products_search_vector_update();

      -- 4. Backfill existing rows so search works immediately
      UPDATE products SET search_vector =
        setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(short_description, '')), 'B');

      -- 5. Create GIN index for fast full-text search lookups
      CREATE INDEX IF NOT EXISTS idx_products_search_vector
        ON products USING GIN (search_vector);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_products_search_vector ON products;
      DROP FUNCTION IF EXISTS products_search_vector_update();
      DROP INDEX IF EXISTS idx_products_search_vector;
      ALTER TABLE products DROP COLUMN IF EXISTS search_vector;
    `);
  },
};
