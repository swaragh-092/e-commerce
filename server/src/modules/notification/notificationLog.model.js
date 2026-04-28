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
            // nullable — SMS/WhatsApp logs use recipientPhone instead
        },
        recipientPhone: {
            type: DataTypes.STRING(30),
            // nullable — email logs don't populate this
        },
        channel: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'email',
            validate: {
                isIn: [['email', 'sms', 'whatsapp', 'skipped']],
            },
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
        userId: {
            type: DataTypes.UUID,
        },
        orderId: {
            type: DataTypes.UUID,
        },
    }, {
        tableName: 'notification_logs',
        timestamps: true,
        updatedAt: false,
        underscored: true,
    });

    NotificationLog.associate = (models) => {
        NotificationLog.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'SET NULL' });
        NotificationLog.belongsTo(models.Order, { foreignKey: 'orderId', onDelete: 'SET NULL' });
    };

    return NotificationLog;
};
