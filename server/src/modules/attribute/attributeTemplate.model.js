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
        displayType: {
            type: DataTypes.STRING(40),
            allowNull: false,
            defaultValue: 'auto',
        },
        valueType: {
            type: DataTypes.STRING(40),
            allowNull: false,
            defaultValue: 'auto',
        },
        unit: {
            type: DataTypes.STRING(20),
            allowNull: true,
        },
        unitCategory: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
    }, {
        tableName: 'attribute_templates',
        timestamps: true,
        underscored: true,
        paranoid: true,
        indexes: [
            { name: 'idx_attribute_templates_active_name_unique', unique: true, fields: ['name'], where: { deleted_at: null } },
            { name: 'idx_attribute_templates_active_slug_unique', unique: true, fields: ['slug'], where: { deleted_at: null } },
        ],
    });

    AttributeTemplate.associate = (models) => {
        AttributeTemplate.hasMany(models.AttributeValue, { foreignKey: 'attributeId', as: 'values', onDelete: 'CASCADE' });
        AttributeTemplate.belongsToMany(models.Category, { through: models.CategoryAttribute, foreignKey: 'attributeId', otherKey: 'categoryId', as: 'categories' });
        AttributeTemplate.hasMany(models.ProductAttribute, { foreignKey: 'attributeId', as: 'productAttributes' });
        AttributeTemplate.hasMany(models.VariantOption, { foreignKey: 'attributeId', as: 'variantOptions' });
    };

    return AttributeTemplate;
};
