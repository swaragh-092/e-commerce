'use strict';

/**
 * Keep product full-text search aligned with the fields customers actually
 * search. Category matching remains a relational lookup in the repository,
 * because categories live in a many-to-many table.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
          setweight(to_tsvector('simple', COALESCE(NEW.sku, '')), 'B') ||
          setweight(to_tsvector('simple', COALESCE(NEW.short_description, '')), 'B') ||
          setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'C');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      UPDATE products SET search_vector =
        setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(sku, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(short_description, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(description, '')), 'C');
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
          setweight(to_tsvector('simple', COALESCE(NEW.short_description, '')), 'B');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      UPDATE products SET search_vector =
        setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(short_description, '')), 'B');
    `);
  },
};
