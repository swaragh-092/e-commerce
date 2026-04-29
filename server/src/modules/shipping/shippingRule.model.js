'use strict';

module.exports = (sequelize, DataTypes) => {
    const ShippingRule = sequelize.define('ShippingRule', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(150),
            allowNull: false,
        },
        priority: {
            type: DataTypes.INTEGER,
            defaultValue: 100,
        },
        enabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        strictOverride: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        zoneId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        providerId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        conditionType: {
            type: DataTypes.STRING(50),
            defaultValue: 'all',
        },
        conditions: {
            type: DataTypes.JSONB,
            defaultValue: {},
        },
        rateType: {
            type: DataTypes.STRING(50),
            defaultValue: 'flat',
        },
        rateConfig: {
            type: DataTypes.JSONB,
            defaultValue: {},
        },
        codAllowed: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        codFee: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        estimatedMinDays: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        estimatedMaxDays: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
    }, {
        tableName: 'shipping_rules',
        timestamps: true,
        underscored: true,
    });

    ShippingRule.associate = (models) => {
        ShippingRule.belongsTo(models.ShippingZone, { foreignKey: 'zoneId', as: 'zone', onDelete: 'SET NULL' });
        ShippingRule.belongsTo(models.ShippingProvider, { foreignKey: 'providerId', as: 'provider', onDelete: 'SET NULL' });
    };

    return ShippingRule;
};
