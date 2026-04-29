'use strict';

module.exports = (sequelize, DataTypes) => {
    const ShipmentEvent = sequelize.define('ShipmentEvent', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        shipmentId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        providerId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        providerEventId: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        awb: DataTypes.STRING(255),
        eventType: DataTypes.STRING(100),
        eventStatus: DataTypes.STRING(100),
        eventTimestamp: DataTypes.DATE,
        payloadHash: DataTypes.STRING(64),
        rawPayload: {
            type: DataTypes.JSONB,
            defaultValue: {},
        },
        processedAt: DataTypes.DATE,
    }, {
        tableName: 'shipment_events',
        timestamps: true,
        underscored: true,
    });

    ShipmentEvent.associate = (models) => {
        ShipmentEvent.belongsTo(models.Shipment, { foreignKey: 'shipmentId', as: 'shipment', onDelete: 'SET NULL' });
        ShipmentEvent.belongsTo(models.ShippingProvider, { foreignKey: 'providerId', as: 'provider', onDelete: 'SET NULL' });
    };

    return ShipmentEvent;
};
