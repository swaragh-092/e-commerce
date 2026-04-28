'use strict';

/**
 * Migration: Add multi-channel support to notification tables.
 *
 * Changes:
 *   notification_templates:
 *     - Drop old unique index on `name` alone
 *     - Add `channel` column (VARCHAR 20, default 'email')
 *     - Add unique index on (name, channel) — one template per event per channel
 *
 *   notification_logs:
 *     - Make `recipient_email` nullable (SMS/WhatsApp logs won't have an email)
 *     - Add `recipient_phone` column (VARCHAR 30, nullable)
 *     - Add `channel` column (VARCHAR 20, default 'email')
 *     - Add index on `channel` for log filtering
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // ── notification_templates ────────────────────────────────────────────

        // 1. Drop the old single-column unique constraint on `name`
        //    The constraint name matches what Sequelize auto-generated for STRING unique:true
        await queryInterface.removeConstraint(
            'notification_templates',
            'notification_templates_name_key'
        ).catch(() => {
            // Constraint may have a different name depending on PG version — ignore if not found
        });

        // 2. Add `channel` column
        await queryInterface.addColumn('notification_templates', 'channel', {
            type: Sequelize.STRING(20),
            allowNull: false,
            defaultValue: 'email',
        });

        // 3. Add composite unique index (name + channel)
        await queryInterface.addIndex('notification_templates', ['name', 'channel'], {
            unique: true,
            name: 'uq_notification_templates_name_channel',
        });

        // ── notification_logs ─────────────────────────────────────────────────

        // 4. Make recipient_email nullable (SMS/WA logs won't have an email)
        await queryInterface.changeColumn('notification_logs', 'recipient_email', {
            type: Sequelize.STRING(255),
            allowNull: true,
        });

        // 5. Add recipient_phone column
        await queryInterface.addColumn('notification_logs', 'recipient_phone', {
            type: Sequelize.STRING(30),
            allowNull: true,
        });

        // 6. Add channel column to logs
        await queryInterface.addColumn('notification_logs', 'channel', {
            type: Sequelize.STRING(20),
            allowNull: false,
            defaultValue: 'email',
        });

        // 7. Index for log filtering by channel
        await queryInterface.addIndex('notification_logs', ['channel'], {
            name: 'idx_notification_logs_channel',
        });
    },

    async down(queryInterface, Sequelize) {
        // Reverse logs changes
        await queryInterface.removeIndex('notification_logs', 'idx_notification_logs_channel');
        await queryInterface.removeColumn('notification_logs', 'channel');
        await queryInterface.removeColumn('notification_logs', 'recipient_phone');
        await queryInterface.changeColumn('notification_logs', 'recipient_email', {
            type: Sequelize.STRING(255),
            allowNull: false,
        });

        // Reverse template changes
        await queryInterface.removeIndex('notification_templates', 'uq_notification_templates_name_channel');
        await queryInterface.removeColumn('notification_templates', 'channel');
        await queryInterface.addConstraint('notification_templates', {
            fields: ['name'],
            type: 'unique',
            name: 'notification_templates_name_key',
        });
    },
};
