'use strict';

module.exports = (sequelize, DataTypes) => {
    const Payment = sequelize.define('Payment', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        orderId: {
            type: DataTypes.UUID,
            unique: true,
        },
        provider: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        transactionId: {
            type: DataTypes.STRING(255),
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        currency: {
            type: DataTypes.STRING(10),
            defaultValue: 'usd',
        },
        status: {
            type: DataTypes.STRING(60),
            defaultValue: 'pending',
            validate: {
                isIn: [[
                    'pending',
                    'completed',
                    'failed',
                    'refunded',
                    'cod_collected',
                    'payment_pending',
                    'pending_cod',
                    'payment_failed',
                    'payment_expired',
                    'paid_cod',
                    'paid_online',
                    'partially_refunded',
                ]],
            },
        },
        metadata: {
            type: DataTypes.JSONB,
        },
    }, {
        tableName: 'payments',
        timestamps: true,
        underscored: true,
    });

    Payment.associate = (models) => {
        Payment.belongsTo(models.Order, { foreignKey: 'orderId' });
    };

    return Payment;
};
