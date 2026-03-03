'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('tags', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            name: { type: Sequelize.STRING(100), unique: true, allowNull: false },
            slug: { type: Sequelize.STRING(100), unique: true, allowNull: false },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.createTable('product_tags', {
            product_id: { type: Sequelize.UUID, primaryKey: true, references: { model: 'products', key: 'id' }, onDelete: 'CASCADE' },
            tag_id: { type: Sequelize.UUID, primaryKey: true, references: { model: 'tags', key: 'id' }, onDelete: 'CASCADE' },
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('product_tags');
        await queryInterface.dropTable('tags');
    },
};
