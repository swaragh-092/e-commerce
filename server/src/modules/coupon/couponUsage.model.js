'use strict';

module.exports = (sequelize, DataTypes) => {
    const CouponUsage = sequelize.define('CouponUsage', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        couponId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        orderId: {
            type: DataTypes.UUID,
        },
    }, {
        tableName: 'coupon_usages',
        timestamps: true,
        updatedAt: false,
        underscored: true,
    });

    CouponUsage.associate = (models) => {
        CouponUsage.belongsTo(models.Coupon, { foreignKey: 'couponId', onDelete: 'CASCADE' });
        CouponUsage.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
        CouponUsage.belongsTo(models.Order, { foreignKey: 'orderId', onDelete: 'SET NULL' });
    };

    return CouponUsage;
};
