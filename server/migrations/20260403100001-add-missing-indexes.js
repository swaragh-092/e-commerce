'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const run = (sql) => queryInterface.sequelize.query(sql);

    // products: speed up status-based listing and featured queries
    await run(`CREATE INDEX IF NOT EXISTS idx_products_status ON products (status) WHERE deleted_at IS NULL`);
    await run(`CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products (is_featured)`);

    // cart_items: fast lookup of an item by cart + product + variant combo
    await run(`CREATE INDEX IF NOT EXISTS idx_cart_items_cart_product_variant ON cart_items (cart_id, product_id, variant_id)`);

    // orders: user order history and status-based job queries
    await run(`CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders (user_id, status)`);

    // attribute_values: list values by parent attribute quickly
    await run(`CREATE INDEX IF NOT EXISTS idx_attribute_values_attribute_id ON attribute_values (attribute_id)`);

    // reviews: fetch product reviews filtered by moderation status
    await run(`CREATE INDEX IF NOT EXISTS idx_reviews_product_status ON reviews (product_id, status)`);
  },

  async down(queryInterface, Sequelize) {
    const run = (sql) => queryInterface.sequelize.query(sql);

    await run(`DROP INDEX IF EXISTS idx_products_status`);
    await run(`DROP INDEX IF EXISTS idx_products_is_featured`);
    await run(`DROP INDEX IF EXISTS idx_cart_items_cart_product_variant`);
    await run(`DROP INDEX IF EXISTS idx_orders_user_status`);
    await run(`DROP INDEX IF EXISTS idx_attribute_values_attribute_id`);
    await run(`DROP INDEX IF EXISTS idx_reviews_product_status`);
  },
};
