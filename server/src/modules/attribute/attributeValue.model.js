'use strict';

module.exports = (sequelize, DataTypes) => {
    const AttributeValue = sequelize.define('AttributeValue', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        attributeId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        value: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        slug: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        sortOrder: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        displayLabel: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        swatchColor: {
            type: DataTypes.STRING(32),
            allowNull: true,
        },
        imageUrl: {
            type: DataTypes.STRING(500),
            allowNull: true,
        },
        unitLabel: {
            type: DataTypes.STRING(20),
            allowNull: true,
        },
        metadata: {
            type: DataTypes.JSONB,
            defaultValue: {},
        },
    }, {
        tableName: 'attribute_values',
        timestamps: true,
        underscored: true,
        updatedAt: false, // only created_at, no updated_at per schema
    });

    AttributeValue.associate = (models) => {
        AttributeValue.belongsTo(models.AttributeTemplate, { foreignKey: 'attributeId', as: 'attribute', onDelete: 'CASCADE' });
        AttributeValue.hasMany(models.ProductAttribute, { foreignKey: 'valueId', as: 'productAttributes' });
        AttributeValue.hasMany(models.VariantOption, { foreignKey: 'valueId', as: 'variantOptions' });
    };

    return AttributeValue;
};
