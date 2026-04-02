'use strict';

/**
 * Seed: Attribute Templates + Values + Category Links
 *
 * Attributes:
 *   Color  → [Red, Dark Red, Yellow, Orange, Green]  → linked to Roots
 *   Size   → [Small, Medium, Large]                  → linked to Roots
 *   Type   → [Organic, Regular, Hybrid]              → linked to Vegetable (inherited by all children)
 *   Bundle Size → [Single, Bunch, Bag]               → linked to Leafy
 *   Freshness   → [Fresh, Semi-dried]                → linked to Leafy
 */

// Category IDs (must match seed-categories.js)
const CAT = {
    VEGETABLE: 'a0000000-0000-0000-0000-000000000001',
    ROOTS:     'a0000000-0000-0000-0000-000000000002',
    LEAFY:     'a0000000-0000-0000-0000-000000000003',
};

// Attribute template IDs
const ATTR = {
    COLOR:       'b0000000-0000-0000-0000-000000000001',
    SIZE:        'b0000000-0000-0000-0000-000000000002',
    TYPE:        'b0000000-0000-0000-0000-000000000003',
    BUNDLE_SIZE: 'b0000000-0000-0000-0000-000000000004',
    FRESHNESS:   'b0000000-0000-0000-0000-000000000005',
};

const now = new Date();

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        // 1. Create attribute templates
        await queryInterface.bulkInsert('attribute_templates', [
            { id: ATTR.COLOR,       name: 'Color',       slug: 'color',       sort_order: 1, created_at: now, updated_at: now },
            { id: ATTR.SIZE,        name: 'Size',        slug: 'size',        sort_order: 2, created_at: now, updated_at: now },
            { id: ATTR.TYPE,        name: 'Type',        slug: 'type',        sort_order: 3, created_at: now, updated_at: now },
            { id: ATTR.BUNDLE_SIZE, name: 'Bundle Size', slug: 'bundle-size', sort_order: 4, created_at: now, updated_at: now },
            { id: ATTR.FRESHNESS,   name: 'Freshness',   slug: 'freshness',   sort_order: 5, created_at: now, updated_at: now },
        ]);

        // 2. Create attribute values
        await queryInterface.bulkInsert('attribute_values', [
            // Color values
            { id: 'c0000000-0000-0000-0000-000000000001', attribute_id: ATTR.COLOR, value: 'Red',       slug: 'red',       sort_order: 1, created_at: now },
            { id: 'c0000000-0000-0000-0000-000000000002', attribute_id: ATTR.COLOR, value: 'Dark Red',  slug: 'dark-red',  sort_order: 2, created_at: now },
            { id: 'c0000000-0000-0000-0000-000000000003', attribute_id: ATTR.COLOR, value: 'Yellow',    slug: 'yellow',    sort_order: 3, created_at: now },
            { id: 'c0000000-0000-0000-0000-000000000004', attribute_id: ATTR.COLOR, value: 'Orange',    slug: 'orange',    sort_order: 4, created_at: now },
            { id: 'c0000000-0000-0000-0000-000000000005', attribute_id: ATTR.COLOR, value: 'Green',     slug: 'green',     sort_order: 5, created_at: now },

            // Size values
            { id: 'c0000000-0000-0000-0000-000000000010', attribute_id: ATTR.SIZE, value: 'Small',  slug: 'small',  sort_order: 1, created_at: now },
            { id: 'c0000000-0000-0000-0000-000000000011', attribute_id: ATTR.SIZE, value: 'Medium', slug: 'medium', sort_order: 2, created_at: now },
            { id: 'c0000000-0000-0000-0000-000000000012', attribute_id: ATTR.SIZE, value: 'Large',  slug: 'large',  sort_order: 3, created_at: now },

            // Type values
            { id: 'c0000000-0000-0000-0000-000000000020', attribute_id: ATTR.TYPE, value: 'Organic',  slug: 'organic',  sort_order: 1, created_at: now },
            { id: 'c0000000-0000-0000-0000-000000000021', attribute_id: ATTR.TYPE, value: 'Regular',  slug: 'regular',  sort_order: 2, created_at: now },
            { id: 'c0000000-0000-0000-0000-000000000022', attribute_id: ATTR.TYPE, value: 'Hybrid',   slug: 'hybrid',   sort_order: 3, created_at: now },

            // Bundle Size values
            { id: 'c0000000-0000-0000-0000-000000000030', attribute_id: ATTR.BUNDLE_SIZE, value: 'Single', slug: 'single', sort_order: 1, created_at: now },
            { id: 'c0000000-0000-0000-0000-000000000031', attribute_id: ATTR.BUNDLE_SIZE, value: 'Bunch',  slug: 'bunch',  sort_order: 2, created_at: now },
            { id: 'c0000000-0000-0000-0000-000000000032', attribute_id: ATTR.BUNDLE_SIZE, value: 'Bag',    slug: 'bag',    sort_order: 3, created_at: now },

            // Freshness values
            { id: 'c0000000-0000-0000-0000-000000000040', attribute_id: ATTR.FRESHNESS, value: 'Fresh',      slug: 'fresh',      sort_order: 1, created_at: now },
            { id: 'c0000000-0000-0000-0000-000000000041', attribute_id: ATTR.FRESHNESS, value: 'Semi-dried', slug: 'semi-dried', sort_order: 2, created_at: now },
        ]);

        // 3. Link attributes to categories
        await queryInterface.bulkInsert('category_attributes', [
            // Type linked to Vegetable (top-level — inherited by Roots, Leafy, Beetroot, Carrot)
            { category_id: CAT.VEGETABLE, attribute_id: ATTR.TYPE },

            // Color and Size linked to Roots (inherited by Beetroot, Carrot)
            { category_id: CAT.ROOTS, attribute_id: ATTR.COLOR },
            { category_id: CAT.ROOTS, attribute_id: ATTR.SIZE },

            // Bundle Size and Freshness linked to Leafy only
            { category_id: CAT.LEAFY, attribute_id: ATTR.BUNDLE_SIZE },
            { category_id: CAT.LEAFY, attribute_id: ATTR.FRESHNESS },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.bulkDelete('category_attributes', {
            category_id: Object.values(CAT),
        });
        await queryInterface.bulkDelete('attribute_values', {
            attribute_id: Object.values(ATTR),
        });
        await queryInterface.bulkDelete('attribute_templates', {
            id: Object.values(ATTR),
        });
    },
};
