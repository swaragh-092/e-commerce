'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('audit_logs', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
            action: { type: Sequelize.STRING(50), allowNull: false },
            entity: { type: Sequelize.STRING(100), allowNull: false },
            entity_id: { type: Sequelize.UUID },
            changes: { type: Sequelize.JSONB },
            ip_address: { type: Sequelize.STRING(50) },
            user_agent: { type: Sequelize.TEXT },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.addIndex('audit_logs', ['entity', 'entity_id'], { name: 'idx_audit_logs_entity' });
        await queryInterface.addIndex('audit_logs', ['user_id'], { name: 'idx_audit_logs_user' });
        await queryInterface.addIndex('audit_logs', ['created_at'], { name: 'idx_audit_logs_created' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('audit_logs');
    },
};
