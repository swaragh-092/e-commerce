'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        return queryInterface.sequelize.transaction(async (t) => {
            // 1. Add SEO fields to products
            await queryInterface.addColumn('products', 'meta_title', { type: Sequelize.STRING(255) }, { transaction: t });
            await queryInterface.addColumn('products', 'meta_description', { type: Sequelize.TEXT }, { transaction: t });
            await queryInterface.addColumn('products', 'meta_keywords', { type: Sequelize.STRING(500) }, { transaction: t });
            await queryInterface.addColumn('products', 'og_image', { type: Sequelize.STRING(500) }, { transaction: t });

            // 2. Add SEO fields to categories
            await queryInterface.addColumn('categories', 'meta_title', { type: Sequelize.STRING(255) }, { transaction: t });
            await queryInterface.addColumn('categories', 'meta_description', { type: Sequelize.TEXT }, { transaction: t });
            await queryInterface.addColumn('categories', 'meta_keywords', { type: Sequelize.STRING(500) }, { transaction: t });
            await queryInterface.addColumn('categories', 'og_image', { type: Sequelize.STRING(500) }, { transaction: t });

            // 3. Create seo_overrides table
            await queryInterface.createTable('seo_overrides', {
                id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
                path: { type: Sequelize.STRING(255), unique: true, allowNull: false },
                meta_title: { type: Sequelize.STRING(255) },
                meta_description: { type: Sequelize.TEXT },
                meta_keywords: { type: Sequelize.STRING(500) },
                og_image: { type: Sequelize.STRING(500) },
                canonical_url: { type: Sequelize.STRING(500) },
                no_index: { type: Sequelize.BOOLEAN, defaultValue: false },
                created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
                updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            }, { transaction: t });

            await queryInterface.addIndex('seo_overrides', ['path'], { unique: true, name: 'idx_seo_overrides_path', transaction: t });
        });
    },

    async down(queryInterface) {
        return queryInterface.sequelize.transaction(async (t) => {
            await queryInterface.dropTable('seo_overrides', { transaction: t });
            await queryInterface.removeColumn('categories', 'meta_title', { transaction: t });
            await queryInterface.removeColumn('categories', 'meta_description', { transaction: t });
            await queryInterface.removeColumn('categories', 'meta_keywords', { transaction: t });
            await queryInterface.removeColumn('categories', 'og_image', { transaction: t });
            await queryInterface.removeColumn('products', 'meta_title', { transaction: t });
            await queryInterface.removeColumn('products', 'meta_description', { transaction: t });
            await queryInterface.removeColumn('products', 'meta_keywords', { transaction: t });
            await queryInterface.removeColumn('products', 'og_image', { transaction: t });
        });
    },
};
