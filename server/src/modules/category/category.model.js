'use strict';

module.exports = (sequelize, DataTypes) => {
    const Category = sequelize.define('Category', {
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
        parentId: {
            type: DataTypes.UUID,
        },
        image: {
            type: DataTypes.STRING(500),
        },
        sortOrder: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
    }, {
        tableName: 'categories',
        timestamps: true,
        underscored: true,
    });

    Category.associate = (models) => {
        Category.belongsTo(models.Category, { foreignKey: 'parentId', as: 'parent', onDelete: 'SET NULL' });
        Category.hasMany(models.Category, { foreignKey: 'parentId', as: 'children' });
        Category.belongsToMany(models.Product, { through: models.ProductCategory, foreignKey: 'categoryId', otherKey: 'productId', as: 'products' });
    };

    return Category;
};
