'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('product_tabs', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false,
            },
            product_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'products',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            title: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            // Rich-text HTML — always sanitized before storage via sanitize-html
            content: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            // Reserved for future tab types (e.g. 'html' | 'shortcode')
            type: {
                type: Sequelize.STRING(50),
                allowNull: false,
                defaultValue: 'html',
            },
            sort_order: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        // Compound index: fast tab lookups per product, sorted by display order
        await queryInterface.addIndex('product_tabs', ['product_id', 'sort_order'], {
            name: 'idx_product_tabs_product_id_sort_order',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('product_tabs');
    },
};
