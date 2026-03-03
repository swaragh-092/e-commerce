'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('users', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            email: { type: Sequelize.STRING(255), unique: true, allowNull: false },
            password: { type: Sequelize.STRING(255), allowNull: false },
            first_name: { type: Sequelize.STRING(100) },
            last_name: { type: Sequelize.STRING(100) },
            role: { type: Sequelize.STRING(20), defaultValue: 'customer' },
            status: { type: Sequelize.STRING(20), defaultValue: 'active' },
            email_verified: { type: Sequelize.BOOLEAN, defaultValue: false },
            last_login_at: { type: Sequelize.DATE },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            deleted_at: { type: Sequelize.DATE },
        });

        await queryInterface.addIndex('users', ['email'], { unique: true, name: 'idx_users_email' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('users');
    },
};
