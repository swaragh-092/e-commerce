'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('reviews', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            product_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'products', key: 'id' }, onDelete: 'CASCADE' },
            user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
            rating: { type: Sequelize.INTEGER, allowNull: false },
            title: { type: Sequelize.STRING(255) },
            body: { type: Sequelize.TEXT },
            is_verified_purchase: { type: Sequelize.BOOLEAN, defaultValue: false },
            status: { type: Sequelize.STRING(20), defaultValue: 'pending' },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.sequelize.query('ALTER TABLE reviews ADD CONSTRAINT chk_rating CHECK (rating >= 1 AND rating <= 5)');
        await queryInterface.addIndex('reviews', ['user_id', 'product_id'], { unique: true, name: 'uniq_user_product_review' });
        await queryInterface.addIndex('reviews', ['product_id'], { name: 'idx_reviews_product' });
        await queryInterface.addIndex('reviews', ['status'], { name: 'idx_reviews_status' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('reviews');
    },
};
