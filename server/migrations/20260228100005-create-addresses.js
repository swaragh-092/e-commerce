'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('addresses', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
            label: { type: Sequelize.STRING(50) },
            full_name: { type: Sequelize.STRING(255), allowNull: false },
            phone: { type: Sequelize.STRING(20) },
            address_line1: { type: Sequelize.STRING(255), allowNull: false },
            address_line2: { type: Sequelize.STRING(255) },
            city: { type: Sequelize.STRING(100), allowNull: false },
            state: { type: Sequelize.STRING(100) },
            postal_code: { type: Sequelize.STRING(20), allowNull: false },
            country: { type: Sequelize.STRING(100), allowNull: false },
            is_default: { type: Sequelize.BOOLEAN, defaultValue: false },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.addIndex('addresses', ['user_id'], { name: 'idx_addresses_user' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('addresses');
    },
};
