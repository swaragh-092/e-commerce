'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('product_variants', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            product_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'products', key: 'id' }, onDelete: 'CASCADE' },
            name: { type: Sequelize.STRING(100), allowNull: false },
            value: { type: Sequelize.STRING(100), allowNull: false },
            price_modifier: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
            quantity: { type: Sequelize.INTEGER, defaultValue: 0 },
            sku: { type: Sequelize.STRING(100) },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.sequelize.query('ALTER TABLE product_variants ADD CONSTRAINT chk_variant_qty CHECK (quantity >= 0)');
        await queryInterface.addIndex('product_variants', ['product_id'], { name: 'idx_variants_product' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('product_variants');
    },
};
