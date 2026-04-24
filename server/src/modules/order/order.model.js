'use strict';

const { ORDER_DEFAULT_STATUS, ORDER_STATUS_VALUES } = require('../../utils/orderWorkflow');

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
            defaultValue: ORDER_DEFAULT_STATUS,
            validate: {
                isIn: [ORDER_STATUS_VALUES],
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
        appliedDiscounts: {
            type: DataTypes.JSONB,
            defaultValue: [],
        },
        shippingAddressSnapshot: {
            type: DataTypes.JSONB,
        },
        notes: {
            type: DataTypes.TEXT,
        },
        paymentMethod: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'razorpay',
            validate: {
                isIn: [['razorpay', 'cod']],
            },
            field: 'payment_method',
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
        Order.hasMany(models.Fulfillment, { foreignKey: 'orderId', as: 'fulfillments', onDelete: 'CASCADE' });
    };

    return Order;
};
