'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        ALTER TABLE products ADD COLUMN first_published_at timestamptz;
        UPDATE products SET first_published_at = created_at WHERE status = 'published';
        CREATE FUNCTION preserve_product_first_publication() RETURNS trigger AS $$
        BEGIN
          IF TG_OP = 'UPDATE' THEN
            NEW.first_published_at := OLD.first_published_at;
          END IF;
          IF NEW.status = 'published' AND NEW.first_published_at IS NULL THEN
            NEW.first_published_at := CURRENT_TIMESTAMP;
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER product_first_publication BEFORE INSERT OR UPDATE OF status
          ON products FOR EACH ROW EXECUTE FUNCTION preserve_product_first_publication();

        CREATE INDEX idx_order_items_discovery_product ON order_items (product_id);

        CREATE TABLE storefront_product_views (
          product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          view_date date NOT NULL DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date),
          browser_id uuid NOT NULL,
          PRIMARY KEY (product_id, view_date, browser_id)
        );
      `, { transaction });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE storefront_product_views;
      DROP INDEX idx_order_items_discovery_product;
      DROP TRIGGER product_first_publication ON products;
      DROP FUNCTION preserve_product_first_publication();
      ALTER TABLE products DROP COLUMN first_published_at;
    `);
  },
};
