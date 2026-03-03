'use strict';

module.exports = (sequelize, DataTypes) => {
    const ProductImage = sequelize.define('ProductImage', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        productId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        url: {
            type: DataTypes.STRING(500),
            allowNull: false,
        },
        alt: {
            type: DataTypes.STRING(255),
        },
        sortOrder: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        isPrimary: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    }, {
        tableName: 'product_images',
        timestamps: true,
        updatedAt: false,
        underscored: true,
    });

    ProductImage.associate = (models) => {
        ProductImage.belongsTo(models.Product, { foreignKey: 'productId', onDelete: 'CASCADE' });
    };

    return ProductImage;
};
