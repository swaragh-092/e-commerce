'use strict';

module.exports = (sequelize, DataTypes) => {
    const CartItem = sequelize.define('CartItem', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        cartId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        productId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        variantId: {
            type: DataTypes.UUID,
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
        },
    }, {
        tableName: 'cart_items',
        timestamps: true,
        underscored: true,
    });

    CartItem.associate = (models) => {
        CartItem.belongsTo(models.Cart, { foreignKey: 'cartId', onDelete: 'CASCADE' });
        CartItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product', onDelete: 'CASCADE' });
        CartItem.belongsTo(models.ProductVariant, { foreignKey: 'variantId', as: 'variant', onDelete: 'SET NULL' });
    };

    return CartItem;
};
