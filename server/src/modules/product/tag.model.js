'use strict';

module.exports = (sequelize, DataTypes) => {
    const Tag = sequelize.define('Tag', {
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
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '',
        },
        imageId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        slug: {
            type: DataTypes.STRING(100),
            unique: true,
            allowNull: false,
        },
    }, {
        tableName: 'tags',
        timestamps: true,
        updatedAt: false,
        underscored: true,
    });

    Tag.associate = (models) => {
        Tag.belongsTo(models.Media, { foreignKey: 'imageId', as: 'image', onDelete: 'SET NULL' });
        Tag.belongsToMany(models.Product, { through: models.ProductTag, foreignKey: 'tagId', otherKey: 'productId' });
    };

    return Tag;
};
