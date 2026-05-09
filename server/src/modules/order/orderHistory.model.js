'use strict';

module.exports = (sequelize, DataTypes) => {
    const OrderHistory = sequelize.define('OrderHistory', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        orderId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        eventType: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        actorId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        actorType: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'system', // 'system', 'customer', 'admin'
        },
        metadata: {
            type: DataTypes.JSONB,
            defaultValue: {},
        },
    }, {
        tableName: 'order_history',
        timestamps: true,
        underscored: true,
        updatedAt: false,
    });

    OrderHistory.associate = (models) => {
        OrderHistory.belongsTo(models.Order, { foreignKey: 'orderId', as: 'order', onDelete: 'CASCADE' });
        OrderHistory.belongsTo(models.User, { foreignKey: 'actorId', as: 'actor', onDelete: 'SET NULL' });
    };

    return OrderHistory;
};
