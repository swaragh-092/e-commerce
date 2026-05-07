'use strict';

module.exports = (sequelize, DataTypes) => {
    const OrderReturnItem = sequelize.define('OrderReturnItem', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        returnId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        orderItemId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        shipmentItemId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
            },
        },
        reason: {
            type: DataTypes.TEXT,
        },
        metadata: {
            type: DataTypes.JSONB,
            defaultValue: {},
        },
    }, {
        tableName: 'order_return_items',
        timestamps: true,
        underscored: true,
    });

    OrderReturnItem.associate = (models) => {
        OrderReturnItem.belongsTo(models.OrderReturn, { foreignKey: 'returnId', as: 'returnRequest', onDelete: 'CASCADE' });
        OrderReturnItem.belongsTo(models.OrderItem, { foreignKey: 'orderItemId', as: 'orderItem', onDelete: 'CASCADE' });
        OrderReturnItem.belongsTo(models.ShipmentItem, { foreignKey: 'shipmentItemId', as: 'shipmentItem', onDelete: 'SET NULL' });
    };

    return OrderReturnItem;
};
