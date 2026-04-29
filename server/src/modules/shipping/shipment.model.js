'use strict';

module.exports = (sequelize, DataTypes) => {
    const Shipment = sequelize.define('Shipment', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        orderId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        fulfillmentId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        providerId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        providerOrderId: DataTypes.STRING(255),
        providerShipmentId: DataTypes.STRING(255),
        awb: DataTypes.STRING(255),
        courierName: DataTypes.STRING(100),
        trackingNumber: DataTypes.STRING(255),
        trackingUrl: DataTypes.STRING(500),
        labelUrl: DataTypes.STRING(500),
        manifestUrl: DataTypes.STRING(500),
        invoiceUrl: DataTypes.STRING(500),
        status: {
            type: DataTypes.STRING(50),
            defaultValue: 'pending',
        },
        statusHistory: {
            type: DataTypes.JSONB,
            defaultValue: () => [],
        },
        rawResponse: {
            type: DataTypes.JSONB,
            defaultValue: null,
        },
    }, {
        tableName: 'shipments',
        timestamps: true,
        underscored: true,
    });

    Shipment.associate = (models) => {
        Shipment.belongsTo(models.Order, { foreignKey: 'orderId', as: 'order', onDelete: 'CASCADE' });
        Shipment.belongsTo(models.Fulfillment, { foreignKey: 'fulfillmentId', as: 'fulfillment', onDelete: 'SET NULL' });
        Shipment.belongsTo(models.ShippingProvider, { foreignKey: 'providerId', as: 'provider', onDelete: 'SET NULL' });
        Shipment.hasMany(models.ShipmentItem, { foreignKey: 'shipmentId', as: 'items', onDelete: 'CASCADE' });
        Shipment.hasMany(models.ShipmentEvent, { foreignKey: 'shipmentId', as: 'events', onDelete: 'CASCADE' });
    };

    return Shipment;
};
