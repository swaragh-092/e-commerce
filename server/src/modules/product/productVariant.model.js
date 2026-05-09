'use strict';

module.exports = (sequelize, DataTypes) => {
    const ProductVariant = sequelize.define('ProductVariant', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        productId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        sku: {
            type: DataTypes.STRING(100),
            allowNull: true,
            unique: true,
        },
        mediaId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'media_id',
        },
        price: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        stockQty: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        reservedQty: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            field: 'reserved_qty',
            validate: {
                min: 0
            }
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        sortOrder: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
    }, {
        tableName: 'product_variants',
        timestamps: true,
        underscored: true,
        paranoid: true,
    });

    ProductVariant.associate = (models) => {
        ProductVariant.belongsTo(models.Product, {
            foreignKey: 'productId',
            as: 'product',
            onDelete: 'CASCADE',
        });
        ProductVariant.hasMany(models.VariantOption, {
            foreignKey: 'variantId',
            as: 'options',
            onDelete: 'CASCADE',
        });
        ProductVariant.belongsTo(models.Media, {
            foreignKey: 'mediaId',
            as: 'media',
            onDelete: 'SET NULL',
        });
    };

    return ProductVariant;
};
