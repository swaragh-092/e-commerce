'use strict';

const { REFUND_STATUS_VALUES, REFUND_DEFAULT_STATUS } = require('../../utils/orderWorkflow');

module.exports = (sequelize, DataTypes) => {
    const OrderRefund = sequelize.define('OrderRefund', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        orderId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        returnId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        paymentId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        currency: {
            type: DataTypes.STRING(10),
            defaultValue: 'INR',
        },
        status: {
            type: DataTypes.STRING(60),
            defaultValue: REFUND_DEFAULT_STATUS,
            validate: {
                isIn: [REFUND_STATUS_VALUES],
            },
        },
        providerRefundId: {
            type: DataTypes.STRING(255),
        },
        reason: {
            type: DataTypes.TEXT,
        },
        metadata: {
            type: DataTypes.JSONB,
            defaultValue: {},
        },
        processedAt: DataTypes.DATE,
    }, {
        tableName: 'order_refunds',
        timestamps: true,
        underscored: true,
    });

    OrderRefund.associate = (models) => {
        OrderRefund.belongsTo(models.Order, { foreignKey: 'orderId', as: 'order', onDelete: 'CASCADE' });
        OrderRefund.belongsTo(models.OrderReturn, { foreignKey: 'returnId', as: 'returnRequest', onDelete: 'SET NULL' });
        OrderRefund.belongsTo(models.Payment, { foreignKey: 'paymentId', as: 'payment', onDelete: 'SET NULL' });
    };

    return OrderRefund;
};
