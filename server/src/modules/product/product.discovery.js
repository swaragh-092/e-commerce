'use strict';

const { sequelize } = require('../index');

const scoreFor = (source) => `(
  SELECT score FROM storefront_product_rankings
  WHERE product_id = "Product"."id" AND source = '${source}'
)`;

const bestSellers = scoreFor('best-selling');
const mostViewed = scoreFor('most-viewed');

const refreshRankings = () => sequelize.transaction(async (transaction) => {
  const [[{ acquired }]] = await sequelize.query(
    "SELECT pg_try_advisory_xact_lock(hashtext('storefront_product_rankings')) AS acquired",
    { transaction },
  );
  if (acquired) {
    await sequelize.query('REFRESH MATERIALIZED VIEW CONCURRENTLY storefront_product_rankings', { transaction });
  }
});

const arrival = 'COALESCE("Product"."first_published_at", "Product"."created_at")';

const recordView = (productId, browserId) => sequelize.query(`
  INSERT INTO storefront_product_views (product_id, browser_id)
  SELECT id, :browserId FROM products
  WHERE id = :productId AND status = 'published' AND is_enabled AND deleted_at IS NULL
  ON CONFLICT DO NOTHING
`, { replacements: { productId, browserId } });

module.exports = { bestSellers, mostViewed, arrival, recordView, refreshRankings };
