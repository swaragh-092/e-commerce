'use strict';

module.exports = (sequelize, DataTypes) => {
    const NotificationTemplate = sequelize.define('NotificationTemplate', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        channel: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'email',
            validate: {
                isIn: [['email', 'sms', 'whatsapp']],
            },
        },
        subject: {
            type: DataTypes.STRING(500),
            allowNull: false,
        },
        bodyHtml: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        bodyText: {
            type: DataTypes.TEXT,
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    }, {
        tableName: 'notification_templates',
        timestamps: true,
        underscored: true,
        indexes: [
            // Unique per (name + channel) — one template per event per channel
            { unique: true, fields: ['name', 'channel'], name: 'uq_notification_templates_name_channel' },
        ],
    });

    return NotificationTemplate;
};
