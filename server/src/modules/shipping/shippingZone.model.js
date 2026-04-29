'use strict';

module.exports = (sequelize, DataTypes) => {
    const ShippingZone = sequelize.define('ShippingZone', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        country: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        state: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        city: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        pincodes: {
            type: DataTypes.JSONB,
            defaultValue: [],
        },
        blockedPincodes: {
            type: DataTypes.JSONB,
            defaultValue: [],
        },
        enabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    }, {
        tableName: 'shipping_zones',
        timestamps: true,
        underscored: true,
    });

    ShippingZone.associate = (models) => {
        ShippingZone.hasMany(models.ShippingRule, { foreignKey: 'zoneId', as: 'rules' });
    };

    return ShippingZone;
};
