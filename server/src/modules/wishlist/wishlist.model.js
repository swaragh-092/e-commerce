'use strict';
const { Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    const Wishlist = sequelize.define('Wishlist', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        sessionId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
    }, {
        tableName: 'wishlists',
        timestamps: true,
        updatedAt: false,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['userId'],
                where: { userId: { [Op.ne]: null } },
                name: 'uniq_wishlists_user_id_not_null',
            },
            {
                unique: true,
                fields: ['sessionId'],
                where: { sessionId: { [Op.ne]: null } },
                name: 'uniq_wishlists_session_id_not_null',
            },
        ],
    });

    Wishlist.associate = (models) => {
        Wishlist.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
        Wishlist.hasMany(models.WishlistItem, { foreignKey: 'wishlistId', onDelete: 'CASCADE' });
    };

    return Wishlist;
};
