'use strict';

module.exports = (sequelize, DataTypes) => {
  const Promotion = sequelize.define(
    'Promotion',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      label: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(30),
        defaultValue: 'sale',
      },
      badgeColor: {
        type: DataTypes.STRING(30),
      },
      badgeIcon: {
        type: DataTypes.STRING(50),
      },
      description: {
        type: DataTypes.TEXT,
      },
      startDate: {
        type: DataTypes.DATE,
      },
      endDate: {
        type: DataTypes.DATE,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      priority: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    },
    {
      tableName: 'promotions',
      timestamps: true,
      underscored: true,
    }
  );

  Promotion.associate = (models) => {
    Promotion.belongsToMany(models.Product, {
      through: models.ProductPromotion,
      foreignKey: 'promotionId',
      otherKey: 'productId',
      as: 'products',
    });
  };

  return Promotion;
};
