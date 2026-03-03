'use strict';

module.exports = (sequelize, DataTypes) => {
    const ProductTag = sequelize.define('ProductTag', {
        productId: {
            type: DataTypes.UUID,
            primaryKey: true,
        },
        tagId: {
            type: DataTypes.UUID,
            primaryKey: true,
        },
    }, {
        tableName: 'product_tags',
        timestamps: false,
        underscored: true,
    });

    return ProductTag;
};
