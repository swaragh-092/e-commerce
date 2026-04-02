'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('media', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            url: { type: Sequelize.STRING(500), allowNull: false },
            filename: { type: Sequelize.STRING(255), allowNull: false },
            mime_type: { type: Sequelize.STRING(100), allowNull: false },
            size: { type: Sequelize.INTEGER, allowNull: false },
            provider: { type: Sequelize.STRING(50), defaultValue: 'local' },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.addIndex('media', ['filename'], { name: 'idx_media_filename' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('media');
    },
};
