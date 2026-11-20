'use strict';

module.exports = (sequelize, DataTypes) => {
    const Brand = sequelize.define('Brand', {
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
        image: {
            type: DataTypes.STRING(500),
        },
        metaTitle: { type: DataTypes.STRING(255), field: 'meta_title' },
        metaDescription: { type: DataTypes.TEXT, field: 'meta_description' },
        metaKeywords: { type: DataTypes.STRING(500), field: 'meta_keywords' },
        ogImage: { type: DataTypes.STRING(500), field: 'og_image' },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            field: 'is_active',
        },
        isPromoted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'is_promoted',
        },
        isFeatured: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'is_featured',
        },
    }, {
        tableName: 'brands',
        timestamps: true,
        underscored: true,
    });

    Brand.associate = (models) => {
        Brand.hasMany(models.Product, { foreignKey: 'brandId', as: 'products' });
    };

    return Brand;
};
