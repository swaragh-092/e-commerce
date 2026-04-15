'use strict';

module.exports = (sequelize, DataTypes) => {
    const ProductAttribute = sequelize.define('ProductAttribute', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        productId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        // Null for custom (free-form) attributes
        attributeId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        // Null for custom (free-form) values
        valueId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        // Used when attributeId IS NULL
        customName: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        // Used when valueId IS NULL (or for custom attrs)
        customValue: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        // true → this attribute defines the variant matrix (used by bulkGenerateVariants)
        isVariantAttr: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        sortOrder: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
    }, {
        tableName: 'product_attributes',
        timestamps: true,
        underscored: true,
    });

    ProductAttribute.associate = (models) => {
        ProductAttribute.belongsTo(models.Product, {
            foreignKey: 'productId',
            as: 'product',
            onDelete: 'CASCADE',
        });
        ProductAttribute.belongsTo(models.AttributeTemplate, {
            foreignKey: 'attributeId',
            as: 'attribute',
            onDelete: 'SET NULL',
        });
        ProductAttribute.belongsTo(models.AttributeValue, {
            foreignKey: 'valueId',
            as: 'value',
            onDelete: 'SET NULL',
        });
    };

    return ProductAttribute;
};
