'use strict';

module.exports = (sequelize, DataTypes) => {
    const FulfillmentItem = sequelize.define('FulfillmentItem', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        fulfillmentId: {
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
            validate: {
                min: 1
            }
        }
    }, {
        tableName: 'fulfillment_items',
        timestamps: true,
        underscored: true,
    });

    FulfillmentItem.associate = (models) => {
        FulfillmentItem.belongsTo(models.Fulfillment, { foreignKey: 'fulfillmentId', as: 'fulfillment', onDelete: 'CASCADE' });
        FulfillmentItem.belongsTo(models.OrderItem, { foreignKey: 'orderItemId', as: 'orderItem' });
    };

    return FulfillmentItem;
};
