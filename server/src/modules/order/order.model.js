'use strict';

module.exports = (sequelize, DataTypes) => {
    const Order = sequelize.define('Order', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        orderNumber: {
            type: DataTypes.STRING(50),
            unique: true,
            allowNull: false,
        },
        userId: {
            type: DataTypes.UUID,
        },
        status: {
            type: DataTypes.STRING(30),
            defaultValue: 'pending_payment',
            validate: {
                isIn: [['pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']],
            },
        },
        subtotal: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        tax: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        shippingCost: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        discountAmount: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        total: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        couponId: {
            type: DataTypes.UUID,
        },
        shippingAddressSnapshot: {
            type: DataTypes.JSONB,
        },
        notes: {
            type: DataTypes.TEXT,
        },
    }, {
        tableName: 'orders',
        timestamps: true,
        underscored: true,
    });

    Order.associate = (models) => {
        Order.belongsTo(models.User, { foreignKey: 'userId' });
        Order.belongsTo(models.Coupon, { foreignKey: 'couponId' });
        Order.hasMany(models.OrderItem, { foreignKey: 'orderId', as: 'items', onDelete: 'CASCADE' });
        Order.hasOne(models.Payment, { foreignKey: 'orderId' });
    };

    return Order;
};
