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
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        value: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        priceModifier: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        quantity: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        sku: {
            type: DataTypes.STRING(100),
        },
    }, {
        tableName: 'product_variants',
        timestamps: true,
        underscored: true,
    });

    ProductVariant.associate = (models) => {
        ProductVariant.belongsTo(models.Product, { foreignKey: 'productId', onDelete: 'CASCADE' });
    };

    return ProductVariant;
};
