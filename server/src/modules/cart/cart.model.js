'use strict';

module.exports = (sequelize, DataTypes) => {
    const Cart = sequelize.define('Cart', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
        },
        sessionId: {
            type: DataTypes.STRING(255),
        },
        status: {
            type: DataTypes.STRING(20),
            defaultValue: 'active',
            validate: {
                isIn: [['active', 'merged', 'converted', 'expired']],
            },
        },
    }, {
        tableName: 'carts',
        timestamps: true,
        underscored: true,
    });

    Cart.associate = (models) => {
        Cart.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
        Cart.hasMany(models.CartItem, { foreignKey: 'cartId', as: 'items', onDelete: 'CASCADE' });
    };

    return Cart;
};
