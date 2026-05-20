'use strict';

module.exports = (sequelize, DataTypes) => {
  const InventoryTransaction = sequelize.define('InventoryTransaction', {
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
    variantId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'variant_id',
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'order_id',
    },
    orderItemId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'order_item_id',
    },
    type: {
      type: DataTypes.STRING(30),
      allowNull: false,
      validate: {
        isIn: [['RESERVE', 'RELEASE', 'SHIP', 'RETURN', 'ADJUSTMENT']],
      },
    },
    qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1 },
    },
    beforeStock: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'before_stock',
    },
    afterStock: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'after_stock',
    },
    beforeReserved: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'before_reserved',
    },
    afterReserved: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'after_reserved',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by',
    },
  }, {
    tableName: 'inventory_transactions',
    underscored: true,
    timestamps: true,
    updatedAt: true,
  });

  InventoryTransaction.associate = (models) => {
    InventoryTransaction.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    InventoryTransaction.belongsTo(models.ProductVariant, { foreignKey: 'variantId', as: 'variant' });
    InventoryTransaction.belongsTo(models.Order, { foreignKey: 'orderId', as: 'order' });
    InventoryTransaction.belongsTo(models.OrderItem, { foreignKey: 'orderItemId', as: 'orderItem' });
    InventoryTransaction.belongsTo(models.User, { foreignKey: 'createdBy', as: 'actor' });
  };

  return InventoryTransaction;
};
