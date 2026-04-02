'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('email_verification_tokens', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
            token: { type: Sequelize.STRING(500), allowNull: false, unique: true },
            expires_at: { type: Sequelize.DATE, allowNull: false },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.addIndex('email_verification_tokens', ['user_id'], { name: 'idx_email_verification_user' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('email_verification_tokens');
    },
};
