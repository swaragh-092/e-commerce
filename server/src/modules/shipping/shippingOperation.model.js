'use strict';

module.exports = (sequelize, DataTypes) => {
    const ShippingOperation = sequelize.define('ShippingOperation', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        shipmentId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        providerId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        operationType: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'create',
        },
        idempotencyKey: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
        },
        status: {
            type: DataTypes.STRING(30),
            allowNull: false,
            defaultValue: 'queued',
        },
        attempts: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        maxAttempts: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 8,
        },
        nextAttemptAt: DataTypes.DATE,
        lockedAt: DataTypes.DATE,
        completedAt: DataTypes.DATE,
        lastError: DataTypes.TEXT,
        requestPayload: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {},
        },
        responsePayload: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
    }, {
        tableName: 'shipping_operations',
        timestamps: true,
        underscored: true,
    });

    ShippingOperation.associate = (models) => {
        ShippingOperation.belongsTo(models.Shipment, { foreignKey: 'shipmentId', as: 'shipment', onDelete: 'CASCADE' });
        ShippingOperation.belongsTo(models.ShippingProvider, { foreignKey: 'providerId', as: 'provider', onDelete: 'SET NULL' });
    };

    return ShippingOperation;
};
