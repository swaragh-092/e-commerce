'use strict';

/**
 * Migration: Enable pg_trgm extension for fuzzy/typo-tolerant search.
 *
 * WHY pg_trgm:
 * - PostgreSQL's built-in tsvector search is exact lexeme match only — no
 *   tolerance for typos. "smasung" does not match "Samsung".
 * - pg_trgm provides trigram-based similarity matching (the % operator and
 *   similarity() function), which handles typos, partial matches, and
 *   approximate string matching.
 * - GIN indexes on gin_trgm_ops make similarity queries fast even on large
 *   tables — same index type used by Amazon RDS/Aurora for search.
 *
 * WHY a separate migration:
 * - Extensions are a DBA-level operation. Keeping it separate makes it easy
 *   to skip if the extension is already installed or needs special
 *   permissions on managed Postgres (RDS, Cloud SQL, etc.).
 */

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP EXTENSION IF EXISTS pg_trgm;
    `);
  },
};
