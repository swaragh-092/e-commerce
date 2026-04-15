'use strict';

/**
 * VariantOption — junction between ProductVariant and (AttributeTemplate + AttributeValue).
 * One row per dimension per SKU.
 * e.g., T-Shirt Red-L → two rows: Color=Red, Size=Large.
 */
module.exports = (sequelize, DataTypes) => {
    const VariantOption = sequelize.define('VariantOption', {
        variantId: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
        },
        attributeId: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
        },
        valueId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
    }, {
        tableName: 'variant_options',
        timestamps: false,
        underscored: true,
    });

    VariantOption.associate = (models) => {
        VariantOption.belongsTo(models.ProductVariant, {
            foreignKey: 'variantId',
            as: 'variant',
            onDelete: 'CASCADE',
        });
        VariantOption.belongsTo(models.AttributeTemplate, {
            foreignKey: 'attributeId',
            as: 'attribute',
            onDelete: 'CASCADE',
        });
        VariantOption.belongsTo(models.AttributeValue, {
            foreignKey: 'valueId',
            as: 'value',
            onDelete: 'CASCADE',
        });
    };

    return VariantOption;
};
