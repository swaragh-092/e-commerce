'use strict';

module.exports = (sequelize, DataTypes) => {
    const ProductCategory = sequelize.define('ProductCategory', {
        productId: {
            type: DataTypes.UUID,
            primaryKey: true,
            references: {
                model: 'products',
                key: 'id'
            }
        },
        categoryId: {
            type: DataTypes.UUID,
            primaryKey: true,
            references: {
                model: 'categories',
                key: 'id'
            }
        },
    }, {
        tableName: 'product_categories',
        timestamps: false,
        underscored: true,
    });

    return ProductCategory;
};
