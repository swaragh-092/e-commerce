'use strict';

module.exports = (sequelize, DataTypes) => {
    const Wishlist = sequelize.define('Wishlist', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
            unique: true,
            allowNull: false,
        },
    }, {
        tableName: 'wishlists',
        timestamps: true,
        underscored: true,
    });

    Wishlist.associate = (models) => {
        Wishlist.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
        Wishlist.hasMany(models.WishlistItem, { foreignKey: 'wishlistId', onDelete: 'CASCADE' });
    };

    return Wishlist;
};
