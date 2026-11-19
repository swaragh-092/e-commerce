'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE MATERIALIZED VIEW storefront_product_trending AS
        WITH bounds AS (
          SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date AS today
        ),
        weekly_views AS (
          SELECT product_id,
            COUNT(*) FILTER (WHERE view_date >= today - 7) AS recent,
            COUNT(*) FILTER (WHERE view_date < today - 7) AS previous
          FROM storefront_product_views CROSS JOIN bounds
          WHERE view_date >= today - 14 AND view_date < today
          GROUP BY product_id
        )
        SELECT product_id, recent - previous AS score
        FROM weekly_views
        WHERE recent >= 5 AND recent > previous
          AND EXISTS (
            SELECT 1 FROM storefront_product_views CROSS JOIN bounds
            WHERE view_date <= today - 14
          );

        CREATE UNIQUE INDEX idx_storefront_product_trending_product
          ON storefront_product_trending (product_id);
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP MATERIALIZED VIEW storefront_product_trending');
  },
};
