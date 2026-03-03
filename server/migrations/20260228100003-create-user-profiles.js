'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('user_profiles', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            user_id: { type: Sequelize.UUID, unique: true, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
            phone: { type: Sequelize.STRING(20) },
            avatar: { type: Sequelize.STRING(500) },
            date_of_birth: { type: Sequelize.DATEONLY },
            gender: { type: Sequelize.STRING(20) },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('user_profiles');
    },
};
