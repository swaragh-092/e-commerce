'use strict';

module.exports = (sequelize, DataTypes) => {
    const NotificationLog = sequelize.define('NotificationLog', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        templateName: {
            type: DataTypes.STRING(100),
        },
        recipientEmail: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        subject: {
            type: DataTypes.STRING(500),
        },
        status: {
            type: DataTypes.STRING(20),
            defaultValue: 'sent',
            validate: {
                isIn: [['sent', 'failed', 'bounced']],
            },
        },
        error: {
            type: DataTypes.TEXT,
        },
    }, {
        tableName: 'notification_logs',
        timestamps: true,
        updatedAt: false,
        underscored: true,
    });

    return NotificationLog;
};
