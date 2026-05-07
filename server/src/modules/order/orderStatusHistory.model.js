'use strict';

module.exports = (sequelize, DataTypes) => {
    const OrderStatusHistory = sequelize.define('OrderStatusHistory', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        orderId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        entityType: {
            type: DataTypes.STRING(40),
            allowNull: false,
        },
        entityId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        statusGroup: {
            type: DataTypes.STRING(40),
            allowNull: false,
        },
        fromStatus: {
            type: DataTypes.STRING(60),
            allowNull: true,
        },
        toStatus: {
            type: DataTypes.STRING(60),
            allowNull: false,
        },
        metadata: {
            type: DataTypes.JSONB,
            defaultValue: {},
        },
        changedBy: {
            type: DataTypes.UUID,
            allowNull: true,
        },
    }, {
        tableName: 'order_status_history',
        timestamps: true,
        underscored: true,
        updatedAt: false,
    });

    OrderStatusHistory.associate = (models) => {
        OrderStatusHistory.belongsTo(models.Order, { foreignKey: 'orderId', as: 'order', onDelete: 'CASCADE' });
        OrderStatusHistory.belongsTo(models.User, { foreignKey: 'changedBy', as: 'actor', onDelete: 'SET NULL' });
    };

    return OrderStatusHistory;
};
