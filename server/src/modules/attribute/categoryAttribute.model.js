'use strict';

module.exports = (sequelize, DataTypes) => {
    const CategoryAttribute = sequelize.define('CategoryAttribute', {
        categoryId: {
            type: DataTypes.UUID,
            primaryKey: true,
            references: {
                model: 'categories',
                key: 'id',
            },
        },
        attributeId: {
            type: DataTypes.UUID,
            primaryKey: true,
            references: {
                model: 'attribute_templates',
                key: 'id',
            },
        },
    }, {
        tableName: 'category_attributes',
        timestamps: false,
        underscored: true,
    });

    return CategoryAttribute;
};
