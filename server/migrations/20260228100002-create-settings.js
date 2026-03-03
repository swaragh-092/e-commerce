'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('settings', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            key: { type: Sequelize.STRING(255), unique: true, allowNull: false },
            value: { type: Sequelize.JSONB, allowNull: false },
            group: { type: Sequelize.STRING(50), allowNull: false },
            updated_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('settings');
    },
};
