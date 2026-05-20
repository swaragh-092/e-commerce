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
        // Shipping dimensions — used for volumetric weight calculation
        weightGrams: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: 500,
        },
        lengthCm: {
            type: DataTypes.DECIMAL(8, 2),
            allowNull: true,
            defaultValue: 10,
        },
        breadthCm: {
            type: DataTypes.DECIMAL(8, 2),
            allowNull: true,
            defaultValue: 10,
        },
        heightCm: {
            type: DataTypes.DECIMAL(8, 2),
            allowNull: true,
            defaultValue: 10,
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
        // Product type: simple (no variants), variable (has variants), combo (bundle of other products)
        type: {
            type: DataTypes.ENUM('simple', 'variable', 'combo'),
            allowNull: false,
            defaultValue: 'simple',
        },
        isFeatured: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        isEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
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
        metaTitle: {
            type: DataTypes.STRING(255),
            field: 'meta_title'
        },
        metaDescription: {
            type: DataTypes.TEXT,
            field: 'meta_description'
        },
        metaKeywords: {
            type: DataTypes.STRING(500),
            field: 'meta_keywords'
        },
        ogImage: {
            type: DataTypes.STRING(500),
            field: 'og_image'
        },
        // Full-Text Search vector — managed by PostgreSQL trigger, read-only in app code
        searchVector: {
            type: DataTypes.TSVECTOR,
            allowNull: true,
            field: 'search_vector',
        },
    }, {
        tableName: 'products',
        timestamps: true,
        underscored: true,
        paranoid: true, // soft delete via deleted_at
        defaultScope: {
            // Exclude internal FTS column from API responses
            attributes: { exclude: ['search_vector'] },
        },
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
        Product.hasMany(models.ProductTab, { foreignKey: 'productId', as: 'tabs', onDelete: 'CASCADE' });
        Product.hasMany(models.InventoryTransaction, { foreignKey: 'productId', as: 'inventoryTransactions' });
        // Combo: items this product bundles (only populated when type === 'combo')
        Product.hasMany(models.ProductComboItem, { foreignKey: 'comboProductId', as: 'comboItems', onDelete: 'CASCADE' });
        // Reverse: which combos include this product as a constituent?
        Product.hasMany(models.ProductComboItem, { foreignKey: 'itemProductId', as: 'partOfCombos', onDelete: 'CASCADE' });
    };

    return Product;
};
