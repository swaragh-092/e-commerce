'use strict';

module.exports = (sequelize, DataTypes) => {
    const OrderItem = sequelize.define('OrderItem', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        orderId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        productId: {
            type: DataTypes.UUID,
        },
        snapshotName: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        snapshotPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        snapshotImage: {
            type: DataTypes.STRING(500),
        },
        snapshotSku: {
            type: DataTypes.STRING(100),
        },
        variantInfo: {
            type: DataTypes.JSONB,
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        total: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
    }, {
        tableName: 'order_items',
        timestamps: true,
        updatedAt: false,
        underscored: true,
    });

    OrderItem.associate = (models) => {
        OrderItem.belongsTo(models.Order, { foreignKey: 'orderId', onDelete: 'CASCADE' });
        OrderItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    };

    return OrderItem;
};
