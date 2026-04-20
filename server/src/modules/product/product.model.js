'use strict';

module.exports = (sequelize, DataTypes) => {
    const Product = sequelize.define('Product', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        slug: {
            type: DataTypes.STRING(255),
            unique: true,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
        },
        shortDescription: {
            type: DataTypes.STRING(500),
        },
        sku: {
            type: DataTypes.STRING(100),
            unique: true,
        },
        price: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        salePrice: {
            type: DataTypes.DECIMAL(10, 2),
        },
        saleStartAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        saleEndAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        saleLabel: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        quantity: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        reservedQty: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        weight: {
            type: DataTypes.DECIMAL(8, 2),
        },
        taxConfig: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: null,
        },
        status: {
            type: DataTypes.STRING(20),
            defaultValue: 'draft',
            validate: {
                isIn: [['draft', 'published']],
            },
        },
        isFeatured: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        avgRating: {
            type: DataTypes.DECIMAL(3, 2),
            allowNull: true,
            defaultValue: null,
        },
        reviewCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        brandId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'brand_id'
        },
    }, {
        tableName: 'products',
        timestamps: true,
        underscored: true,
        paranoid: true, // soft delete via deleted_at
    });

    Product.associate = (models) => {
        Product.belongsTo(models.Brand, { foreignKey: 'brandId', as: 'brand' });
        Product.belongsToMany(models.Category, { through: models.ProductCategory, foreignKey: 'productId', otherKey: 'categoryId', as: 'categories' });
        Product.hasMany(models.ProductImage, { foreignKey: 'productId', as: 'images', onDelete: 'CASCADE' });
        Product.hasMany(models.ProductVariant, { foreignKey: 'productId', as: 'variants', onDelete: 'CASCADE' });
        Product.hasMany(models.ProductAttribute, { foreignKey: 'productId', as: 'attributes', onDelete: 'CASCADE' });
        Product.belongsToMany(models.Tag, { through: models.ProductTag, foreignKey: 'productId', otherKey: 'tagId', as: 'tags' });
        Product.hasMany(models.Review, { foreignKey: 'productId', onDelete: 'CASCADE' });
        Product.hasMany(models.CartItem, { foreignKey: 'productId' });
        Product.hasMany(models.WishlistItem, { foreignKey: 'productId', onDelete: 'CASCADE' });
    };

    return Product;
};
