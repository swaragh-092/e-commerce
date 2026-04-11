'use strict';

const { Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    const WishlistItem = sequelize.define('WishlistItem', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        wishlistId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        productId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        variantId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
    }, {
        tableName: 'wishlist_items',
        timestamps: true,
        updatedAt: false,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['wishlistId', 'productId'],
                where: { variantId: null },
                name: 'uniq_wishlist_product_no_variant',
            },
            {
                unique: true,
                fields: ['wishlistId', 'productId', 'variantId'],
                where: { variantId: { [Op.ne]: null } },
                name: 'uniq_wishlist_product_variant',
            }
        ]
    });

    WishlistItem.associate = (models) => {
        WishlistItem.belongsTo(models.Wishlist, { foreignKey: 'wishlistId', onDelete: 'CASCADE' });
        WishlistItem.belongsTo(models.Product, { foreignKey: 'productId', onDelete: 'CASCADE' });
        WishlistItem.belongsTo(models.ProductVariant, { foreignKey: 'variantId', as: 'variant', onDelete: 'SET NULL' });
    };

    return WishlistItem;
};
