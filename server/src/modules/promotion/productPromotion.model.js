'use strict';

module.exports = (sequelize, DataTypes) => {
  const ProductPromotion = sequelize.define(
    'ProductPromotion',
    {
      productId: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      promotionId: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
    },
    {
      tableName: 'product_promotions',
      timestamps: false,
      underscored: true,
    }
  );

  return ProductPromotion;
};
