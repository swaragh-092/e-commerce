'use strict';

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
    }, {
        tableName: 'wishlist_items',
        timestamps: true,
        updatedAt: false,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['wishlistId', 'productId'],
            }
        ]
    });

    WishlistItem.associate = (models) => {
        WishlistItem.belongsTo(models.Wishlist, { foreignKey: 'wishlistId', onDelete: 'CASCADE' });
        WishlistItem.belongsTo(models.Product, { foreignKey: 'productId', onDelete: 'CASCADE' });
    };

    return WishlistItem;
};
