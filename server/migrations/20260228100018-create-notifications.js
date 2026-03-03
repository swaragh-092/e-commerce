'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('notification_templates', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            name: { type: Sequelize.STRING(100), unique: true, allowNull: false },
            subject: { type: Sequelize.STRING(500), allowNull: false },
            body_html: { type: Sequelize.TEXT, allowNull: false },
            body_text: { type: Sequelize.TEXT },
            is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.createTable('notification_logs', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            template_name: { type: Sequelize.STRING(100) },
            recipient_email: { type: Sequelize.STRING(255), allowNull: false },
            subject: { type: Sequelize.STRING(500) },
            status: { type: Sequelize.STRING(20), defaultValue: 'sent' },
            error: { type: Sequelize.TEXT },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.addIndex('notification_logs', ['status'], { name: 'idx_notification_logs_status' });
        await queryInterface.addIndex('notification_logs', ['created_at'], { name: 'idx_notification_logs_created' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('notification_logs');
        await queryInterface.dropTable('notification_templates');
    },
};
