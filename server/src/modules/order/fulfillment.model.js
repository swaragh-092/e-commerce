'use strict';

module.exports = (sequelize, DataTypes) => {
    const Fulfillment = sequelize.define('Fulfillment', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        orderId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        trackingNumber: {
            type: DataTypes.STRING(255),
        },
        courier: {
            type: DataTypes.STRING(100),
        },
        notes: {
            type: DataTypes.TEXT,
        },
        status: {
            type: DataTypes.STRING(50),
            defaultValue: 'shipped',
        }
    }, {
        tableName: 'fulfillments',
        timestamps: true,
        underscored: true,
    });

    Fulfillment.associate = (models) => {
        Fulfillment.belongsTo(models.Order, { foreignKey: 'orderId', as: 'order', onDelete: 'CASCADE' });
        Fulfillment.hasMany(models.FulfillmentItem, { foreignKey: 'fulfillmentId', as: 'items', onDelete: 'CASCADE' });
    };

    return Fulfillment;
};
