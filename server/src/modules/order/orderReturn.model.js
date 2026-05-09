'use strict';

const { PUT_BACK_RECORD_STATUS_VALUES } = require('../../utils/orderWorkflow');

module.exports = (sequelize, DataTypes) => {
    const OrderReturn = sequelize.define('OrderReturn', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        orderId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        requestedBy: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        type: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['return', 'replacement']],
            },
        },
        status: {
            type: DataTypes.STRING(60),
            allowNull: false,
            validate: {
                isIn: [PUT_BACK_RECORD_STATUS_VALUES],
            },
        },
        reason: {
            type: DataTypes.TEXT,
        },
        resolutionNotes: {
            type: DataTypes.TEXT,
        },
        metadata: {
            type: DataTypes.JSONB,
            defaultValue: {},
        },
        approvedAt: DataTypes.DATE,
        rejectedAt: DataTypes.DATE,
        completedAt: DataTypes.DATE,
        deletedAt: DataTypes.DATE,
    }, {
        tableName: 'order_returns',
        timestamps: true,
        underscored: true,
        paranoid: true,
    });

    OrderReturn.associate = (models) => {
        OrderReturn.belongsTo(models.Order, { foreignKey: 'orderId', as: 'order', onDelete: 'CASCADE' });
        OrderReturn.belongsTo(models.User, { foreignKey: 'requestedBy', as: 'requester', onDelete: 'SET NULL' });
        OrderReturn.hasMany(models.OrderReturnItem, { foreignKey: 'returnId', as: 'items', onDelete: 'CASCADE' });
        OrderReturn.hasMany(models.OrderRefund, { foreignKey: 'returnId', as: 'refunds', onDelete: 'SET NULL' });
    };

    return OrderReturn;
};
