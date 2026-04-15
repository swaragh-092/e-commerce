'use strict';

module.exports = (sequelize, DataTypes) => {
    const AttributeTemplate = sequelize.define('AttributeTemplate', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(100),
            unique: true,
            allowNull: false,
        },
        slug: {
            type: DataTypes.STRING(100),
            unique: true,
            allowNull: false,
        },
        sortOrder: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
    }, {
        tableName: 'attribute_templates',
        timestamps: true,
        underscored: true,
    });

    AttributeTemplate.associate = (models) => {
        AttributeTemplate.hasMany(models.AttributeValue, { foreignKey: 'attributeId', as: 'values', onDelete: 'CASCADE' });
        AttributeTemplate.belongsToMany(models.Category, { through: models.CategoryAttribute, foreignKey: 'attributeId', otherKey: 'categoryId', as: 'categories' });
        AttributeTemplate.hasMany(models.ProductAttribute, { foreignKey: 'attributeId', as: 'productAttributes' });
        AttributeTemplate.hasMany(models.VariantOption, { foreignKey: 'attributeId', as: 'variantOptions' });
    };

    return AttributeTemplate;
};
