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
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
        },
        type: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['percentage', 'fixed_amount', 'free_shipping']],
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
        campaignStatus: {
            type: DataTypes.STRING(20),
            defaultValue: 'active',
            validate: {
                isIn: [['draft', 'active', 'paused', 'archived']],
            },
        },
        applicationMode: {
            type: DataTypes.STRING(20),
            defaultValue: 'manual',
            validate: {
                isIn: [['manual', 'suggest', 'auto']],
            },
        },
        stackingRules: {
            type: DataTypes.JSONB,
            defaultValue: {
                allowOrderDiscounts: false,
                allowShippingDiscounts: true,
                allowMultipleCoupons: false,
            },
        },
        applicableTo: {
            type: DataTypes.STRING(20),
            defaultValue: 'all',
            validate: {
                isIn: [['all', 'category', 'product', 'brand']],
            },
        },
        applicableIds: {
            type: DataTypes.JSONB,
            defaultValue: [],
        },
        excludedProductIds: {
            type: DataTypes.JSONB,
            defaultValue: [],
        },
        excludedCategoryIds: {
            type: DataTypes.JSONB,
            defaultValue: [],
        },
        excludedBrandIds: {
            type: DataTypes.JSONB,
            defaultValue: [],
        },
        excludeSaleItems: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        visibility: {
            type: DataTypes.STRING(20),
            defaultValue: 'private',
            validate: {
                isIn: [['private', 'public']],
            },
        },
        customerEligibility: {
            type: DataTypes.STRING(20),
            defaultValue: 'all',
            validate: {
                isIn: [['all', 'authenticated', 'first_order']],
            },
        },
        isExclusive: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        priority: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
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
