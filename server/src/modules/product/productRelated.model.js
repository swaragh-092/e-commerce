'use strict';

module.exports = (sequelize, DataTypes) => {
  const ProductRelated = sequelize.define('ProductRelated', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'product_id',
    },
    relatedProductId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'related_product_id',
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'sort_order',
    },
  }, {
    tableName: 'product_related',
    timestamps: false,
    underscored: true,
  });

  ProductRelated.associate = (models) => {
    ProductRelated.belongsTo(models.Product, {
      foreignKey: 'productId',
      as: 'product',
      onDelete: 'CASCADE',
    });
    ProductRelated.belongsTo(models.Product, {
      foreignKey: 'relatedProductId',
      as: 'relatedProduct',
      onDelete: 'CASCADE',
    });
  };

  return ProductRelated;
};
