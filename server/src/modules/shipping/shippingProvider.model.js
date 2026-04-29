'use strict';

module.exports = (sequelize, DataTypes) => {
    const ShippingProvider = sequelize.define('ShippingProvider', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        code: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'manual',
        },
        enabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        isDefault: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        mode: {
            type: DataTypes.STRING(50),
            defaultValue: 'manual',
        },
        supportsCod: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        supportsReturns: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        supportsReversePickup: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        supportsHeavyItems: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        supportsFragileItems: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        maxWeightKg: {
            type: DataTypes.DECIMAL(10, 3),
            allowNull: true,
        },
        maxLengthCm: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        },
        maxBreadthCm: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        },
        maxHeightCm: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        },
        supportedRegions: {
            type: DataTypes.JSONB,
            defaultValue: [],
        },
        blockedRegions: {
            type: DataTypes.JSONB,
            defaultValue: [],
        },
        credentialsEncrypted: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        webhookSecret: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        settings: {
            type: DataTypes.JSONB,
            defaultValue: {},
        },
    }, {
        tableName: 'shipping_providers',
        timestamps: true,
        underscored: true,
    });

    ShippingProvider.associate = (models) => {
        ShippingProvider.hasMany(models.ShippingQuote, { foreignKey: 'providerId', as: 'quotes' });
        ShippingProvider.hasMany(models.Shipment, { foreignKey: 'providerId', as: 'shipments' });
        ShippingProvider.hasMany(models.ShippingRule, { foreignKey: 'providerId', as: 'rules' });
    };

    return ShippingProvider;
};
