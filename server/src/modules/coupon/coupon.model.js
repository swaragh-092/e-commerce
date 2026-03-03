'use strict';

module.exports = (sequelize, DataTypes) => {
    const Coupon = sequelize.define('Coupon', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        code: {
            type: DataTypes.STRING(50),
            unique: true,
            allowNull: false,
        },
        type: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['percentage', 'fixed_amount']],
            },
        },
        value: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        minOrderAmount: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        maxDiscount: {
            type: DataTypes.DECIMAL(10, 2),
        },
        usageLimit: {
            type: DataTypes.INTEGER,
        },
        usedCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        perUserLimit: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
        },
        startDate: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        endDate: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        applicableTo: {
            type: DataTypes.STRING(20),
            defaultValue: 'all',
            validate: {
                isIn: [['all', 'category', 'product']],
            },
        },
        applicableIds: {
            type: DataTypes.JSONB,
        },
    }, {
        tableName: 'coupons',
        timestamps: true,
        underscored: true,
    });

    Coupon.associate = (models) => {
        Coupon.hasMany(models.CouponUsage, { foreignKey: 'couponId', onDelete: 'CASCADE' });
        Coupon.hasMany(models.Order, { foreignKey: 'couponId' });
    };

    return Coupon;
};
