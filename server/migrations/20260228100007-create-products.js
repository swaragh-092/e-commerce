'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('products', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            name: { type: Sequelize.STRING(255), allowNull: false },
            slug: { type: Sequelize.STRING(255), unique: true, allowNull: false },
            description: { type: Sequelize.TEXT },
            short_description: { type: Sequelize.STRING(500) },
            sku: { type: Sequelize.STRING(100), unique: true },
            price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
            sale_price: { type: Sequelize.DECIMAL(10, 2) },
            quantity: { type: Sequelize.INTEGER, defaultValue: 0 },
            reserved_qty: { type: Sequelize.INTEGER, defaultValue: 0 },
            weight: { type: Sequelize.DECIMAL(8, 2) },
            tax_rate: { type: Sequelize.DECIMAL(5, 4) },
            status: { type: Sequelize.STRING(20), defaultValue: 'draft' },
            is_featured: { type: Sequelize.BOOLEAN, defaultValue: false },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            deleted_at: { type: Sequelize.DATE },
        });

        // CHECK constraints
        await queryInterface.sequelize.query('ALTER TABLE products ADD CONSTRAINT chk_price_positive CHECK (price > 0)');
        await queryInterface.sequelize.query('ALTER TABLE products ADD CONSTRAINT chk_sale_price CHECK (sale_price IS NULL OR sale_price < price)');
        await queryInterface.sequelize.query('ALTER TABLE products ADD CONSTRAINT chk_quantity CHECK (quantity >= 0)');
        await queryInterface.sequelize.query('ALTER TABLE products ADD CONSTRAINT chk_reserved CHECK (reserved_qty >= 0 AND reserved_qty <= quantity)');

        // Indexes
        await queryInterface.addIndex('products', ['slug'], { name: 'idx_products_slug' });
        await queryInterface.addIndex('products', ['status'], { name: 'idx_products_status' });
        await queryInterface.addIndex('products', ['is_featured'], { name: 'idx_products_featured', where: { is_featured: true } });

        // Junction Table
        await queryInterface.createTable('product_categories', {
            product_id: { type: Sequelize.UUID, primaryKey: true, references: { model: 'products', key: 'id' }, onDelete: 'CASCADE' },
            category_id: { type: Sequelize.UUID, primaryKey: true, references: { model: 'categories', key: 'id' }, onDelete: 'CASCADE' },
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('product_categories');
        await queryInterface.dropTable('products');
    },
};
