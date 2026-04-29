'use strict';

module.exports = (sequelize, DataTypes) => {
    const ShipmentItem = sequelize.define('ShipmentItem', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        shipmentId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        orderItemId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    }, {
        tableName: 'shipment_items',
        timestamps: true,
        underscored: true,
    });

    ShipmentItem.associate = (models) => {
        ShipmentItem.belongsTo(models.Shipment, { foreignKey: 'shipmentId', as: 'shipment', onDelete: 'CASCADE' });
        ShipmentItem.belongsTo(models.OrderItem, { foreignKey: 'orderItemId', as: 'orderItem', onDelete: 'CASCADE' });
    };

    return ShipmentItem;
};
