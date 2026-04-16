'use strict';

/**
 * Seed: Products (beet-110, beet-222) + Product-Category links + Variants
 *
 * Both products are under the Beetroot category.
 * Each gets Color, Type, and Size variants.
 */

// Category IDs (must match seed-categories.js)
const CAT_BEETROOT = 'a0000000-0000-0000-0000-000000000004';

// Product IDs
const PROD = {
    BEET_110: 'd0000000-0000-0000-0000-000000000001',
    BEET_222: 'd0000000-0000-0000-0000-000000000002',
};

const now = new Date();

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        // 1. Create products
        await queryInterface.bulkInsert('products', [
            {
                id: PROD.BEET_110,
                name: 'Beet-110',
                slug: 'beet-110',
                description: 'Premium beetroot variety — Beet-110. Deep red color, great for juicing and cooking.',
                short_description: 'Premium beetroot variety Beet-110',
                sku: 'BEET-110',
                price: 45.00,
                sale_price: null,
                quantity: 200,
                reserved_qty: 0,
                weight: 300.00,
                tax_rate: null,
                status: 'published',
                is_featured: true,
                created_at: now,
                updated_at: now,
            },
            {
                id: PROD.BEET_222,
                name: 'Beet-222',
                slug: 'beet-222',
                description: 'High-yield beetroot variety — Beet-222. Versatile, suitable for salads and pickling.',
                short_description: 'High-yield beetroot variety Beet-222',
                sku: 'BEET-222',
                price: 55.00,
                sale_price: 49.99,
                quantity: 150,
                reserved_qty: 0,
                weight: 350.00,
                tax_rate: null,
                status: 'published',
                is_featured: false,
                created_at: now,
                updated_at: now,
            },
        ]);

        // 2. Link products to Beetroot category
        await queryInterface.bulkInsert('product_categories', [
            { product_id: PROD.BEET_110, category_id: CAT_BEETROOT },
            { product_id: PROD.BEET_222, category_id: CAT_BEETROOT },
        ]);

        // 3. Create product variants (with new schema: price, stock_qty instead of price_modifier, quantity)
        await queryInterface.bulkInsert('product_variants', [
            // --- Beet-110 variants ---
            // Color
            { id: 'e0000000-0000-0000-0000-000000000001', product_id: PROD.BEET_110, price: 45.00, stock_qty: 80,  sku: 'BEET-110-RED',     is_active: true, sort_order: 0, created_at: now, updated_at: now },
            { id: 'e0000000-0000-0000-0000-000000000002', product_id: PROD.BEET_110, price: 50.00, stock_qty: 60,  sku: 'BEET-110-DKRED',   is_active: true, sort_order: 1, created_at: now, updated_at: now },
            // Type
            { id: 'e0000000-0000-0000-0000-000000000003', product_id: PROD.BEET_110, price: 55.00, stock_qty: 50, sku: 'BEET-110-ORG',     is_active: true, sort_order: 2, created_at: now, updated_at: now },
            { id: 'e0000000-0000-0000-0000-000000000004', product_id: PROD.BEET_110, price: 45.00, stock_qty: 90, sku: 'BEET-110-REG',     is_active: true, sort_order: 3, created_at: now, updated_at: now },
            // Size
            { id: 'e0000000-0000-0000-0000-000000000005', product_id: PROD.BEET_110, price: 40.00, stock_qty: 70, sku: 'BEET-110-SM',      is_active: true, sort_order: 4, created_at: now, updated_at: now },
            { id: 'e0000000-0000-0000-0000-000000000006', product_id: PROD.BEET_110, price: 45.00, stock_qty: 80, sku: 'BEET-110-MD',      is_active: true, sort_order: 5, created_at: now, updated_at: now },
            { id: 'e0000000-0000-0000-0000-000000000007', product_id: PROD.BEET_110, price: 53.00, stock_qty: 50, sku: 'BEET-110-LG',      is_active: true, sort_order: 6, created_at: now, updated_at: now },

            // --- Beet-222 variants ---
            // Color
            { id: 'e0000000-0000-0000-0000-000000000010', product_id: PROD.BEET_222, price: 55.00, stock_qty: 60,  sku: 'BEET-222-RED',     is_active: true, sort_order: 0, created_at: now, updated_at: now },
            { id: 'e0000000-0000-0000-0000-000000000011', product_id: PROD.BEET_222, price: 60.00, stock_qty: 40,  sku: 'BEET-222-DKRED',   is_active: true, sort_order: 1, created_at: now, updated_at: now },
            // Type
            { id: 'e0000000-0000-0000-0000-000000000012', product_id: PROD.BEET_222, price: 67.00, stock_qty: 40, sku: 'BEET-222-ORG',     is_active: true, sort_order: 2, created_at: now, updated_at: now },
            { id: 'e0000000-0000-0000-0000-000000000013', product_id: PROD.BEET_222, price: 55.00, stock_qty: 70, sku: 'BEET-222-REG',     is_active: true, sort_order: 3, created_at: now, updated_at: now },
            // Size
            { id: 'e0000000-0000-0000-0000-000000000014', product_id: PROD.BEET_222, price: 50.00, stock_qty: 50, sku: 'BEET-222-SM',      is_active: true, sort_order: 4, created_at: now, updated_at: now },
            { id: 'e0000000-0000-0000-0000-000000000015', product_id: PROD.BEET_222, price: 55.00, stock_qty: 60, sku: 'BEET-222-MD',      is_active: true, sort_order: 5, created_at: now, updated_at: now },
            { id: 'e0000000-0000-0000-0000-000000000016', product_id: PROD.BEET_222, price: 65.00, stock_qty: 40, sku: 'BEET-222-LG',      is_active: true, sort_order: 6, created_at: now, updated_at: now },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.bulkDelete('product_variants', {
            product_id: Object.values(PROD),
        });
        await queryInterface.bulkDelete('product_categories', {
            product_id: Object.values(PROD),
        });
        await queryInterface.bulkDelete('products', {
            id: Object.values(PROD),
        });
    },
};
