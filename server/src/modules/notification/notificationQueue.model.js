'use strict';

module.exports = (sequelize, DataTypes) => {
    const NotificationQueue = sequelize.define('NotificationQueue', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        templateName: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        channel: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['email', 'sms', 'whatsapp']],
            },
        },
        recipientEmail: DataTypes.STRING(255),
        recipientPhone: DataTypes.STRING(30),
        variables: {
            type: DataTypes.JSONB,
            defaultValue: () => ({}),
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'queued',
            validate: {
                isIn: [['queued', 'processing', 'sent', 'failed', 'skipped']],
            },
        },
        attempts: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        maxAttempts: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 3,
        },
        nextAttemptAt: DataTypes.DATE,
        lockedAt: DataTypes.DATE,
        sentAt: DataTypes.DATE,
        error: DataTypes.TEXT,
        userId: DataTypes.UUID,
        orderId: DataTypes.UUID,
    }, {
        tableName: 'notification_queue',
        timestamps: true,
        underscored: true,
    });

    NotificationQueue.associate = (models) => {
        NotificationQueue.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'SET NULL' });
        NotificationQueue.belongsTo(models.Order, { foreignKey: 'orderId', onDelete: 'SET NULL' });
    };

    return NotificationQueue;
};
