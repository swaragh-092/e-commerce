'use strict';

module.exports = (sequelize, DataTypes) => {
    const ProductComboItem = sequelize.define('ProductComboItem', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        comboProductId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        itemProductId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        variantId: {
            type: DataTypes.UUID,
            allowNull: true,
            defaultValue: null,
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            validate: { min: 1 },
        },
        sortOrder: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
    }, {
        tableName: 'product_combo_items',
        timestamps: true,
        underscored: true,
    });

    ProductComboItem.associate = (models) => {
        ProductComboItem.belongsTo(models.Product, {
            foreignKey: 'comboProductId',
            as: 'comboProduct',
        });
        ProductComboItem.belongsTo(models.Product, {
            foreignKey: 'itemProductId',
            as: 'item',
        });
        ProductComboItem.belongsTo(models.ProductVariant, {
            foreignKey: 'variantId',
            as: 'variant',
            onDelete: 'SET NULL',
            constraints: true
        });
    };

    return ProductComboItem;
};
