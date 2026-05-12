'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query(`
            UPDATE products p
            SET quantity = variant_totals.total_stock
            FROM (
                SELECT product_id, COALESCE(SUM(stock_qty), 0)::integer AS total_stock
                FROM product_variants
                WHERE deleted_at IS NULL AND is_active = true
                GROUP BY product_id
            ) AS variant_totals
            WHERE p.id = variant_totals.product_id
        `);
    },

    async down() {
        // Derived stock backfill is intentionally not reversible.
    },
};
