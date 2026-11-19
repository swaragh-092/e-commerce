'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE MATERIALIZED VIEW storefront_product_rankings AS
        SELECT 'best-selling'::text AS source, oi.product_id, COUNT(DISTINCT oi.order_id) AS score
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN payments p ON p.order_id = o.id
        WHERE oi.product_id IS NOT NULL
          AND o.created_at >= NOW() - INTERVAL '30 days'
          AND o.status NOT IN ('cancelled', 'refunded')
          AND p.status IN ('paid_online', 'paid_cod', 'partially_refunded', 'completed', 'cod_collected')
          AND oi.quantity > (
            SELECT COALESCE(SUM(ri.quantity), 0)
            FROM order_return_items ri JOIN order_returns r ON r.id = ri.return_id
            WHERE ri.order_item_id = oi.id AND r.deleted_at IS NULL
              AND r.type = 'return' AND r.status IN ('return_completed', 'returned')
          )
        GROUP BY oi.product_id
        UNION ALL
        SELECT 'most-viewed', product_id, COUNT(*)
        FROM storefront_product_views
        WHERE view_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 6
        GROUP BY product_id;

        CREATE UNIQUE INDEX idx_storefront_product_rankings_source_product
          ON storefront_product_rankings (source, product_id);
      `, { transaction });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP MATERIALIZED VIEW storefront_product_rankings');
  },
};
