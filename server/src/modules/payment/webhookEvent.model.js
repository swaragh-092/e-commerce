'use strict';

module.exports = (sequelize, DataTypes) => {
    const WebhookEvent = sequelize.define('WebhookEvent', {
        id: {
            type: DataTypes.STRING(255),
            primaryKey: true,       // Stripe event ID (evt_xxx) — NOT UUID
        },
        eventType: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        processedAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        tableName: 'webhook_events',
        timestamps: false,
        underscored: true,
    });

    return WebhookEvent;
};
