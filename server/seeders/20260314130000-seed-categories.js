'use strict';

/**
 * Seed: Categories
 *
 * Hierarchy:
 *   Vegetable (top)
 *   ├── Roots
 *   │   ├── Beetroot
 *   │   └── Carrot
 *   └── Leafy
 *   Fruits (top)
 */

// Fixed UUIDs for referencing in other seeders
const IDS = {
    VEGETABLE: 'a0000000-0000-0000-0000-000000000001',
    ROOTS:     'a0000000-0000-0000-0000-000000000002',
    LEAFY:     'a0000000-0000-0000-0000-000000000003',
    BEETROOT:  'a0000000-0000-0000-0000-000000000004',
    CARROT:    'a0000000-0000-0000-0000-000000000005',
    FRUITS:    'a0000000-0000-0000-0000-000000000006',
};

const now = new Date();

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        await queryInterface.bulkInsert('categories', [
            // Top-level
            { id: IDS.VEGETABLE, name: 'Vegetable', slug: 'vegetable', description: 'Fresh vegetables', parent_id: null, sort_order: 1, created_at: now, updated_at: now },
            { id: IDS.FRUITS,    name: 'Fruits',    slug: 'fruits',    description: 'Fresh fruits',     parent_id: null, sort_order: 2, created_at: now, updated_at: now },

            // Under Vegetable
            { id: IDS.ROOTS, name: 'Roots', slug: 'roots', description: 'Root vegetables', parent_id: IDS.VEGETABLE, sort_order: 1, created_at: now, updated_at: now },
            { id: IDS.LEAFY, name: 'Leafy', slug: 'leafy', description: 'Leafy greens',    parent_id: IDS.VEGETABLE, sort_order: 2, created_at: now, updated_at: now },

            // Under Roots
            { id: IDS.BEETROOT, name: 'Beetroot', slug: 'beetroot', description: 'Beetroot varieties', parent_id: IDS.ROOTS, sort_order: 1, created_at: now, updated_at: now },
            { id: IDS.CARROT,   name: 'Carrot',   slug: 'carrot',   description: 'Carrot varieties',  parent_id: IDS.ROOTS, sort_order: 2, created_at: now, updated_at: now },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.bulkDelete('categories', { id: Object.values(IDS) });
    },
};
