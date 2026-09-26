'use strict';

module.exports = (sequelize, DataTypes) => {
  const InventoryAlert = sequelize.define('InventoryAlert', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    inventoryKey: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    productId: { type: DataTypes.UUID, allowNull: false },
    variantId: { type: DataTypes.UUID, allowNull: true },
    severity: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { isIn: [['low_stock', 'out_of_stock']] },
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'open',
      validate: { isIn: [['open', 'acknowledged', 'resolved']] },
    },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    reservedQty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    availableQty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    threshold: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
    firstDetectedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lastDetectedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lastNotifiedAt: { type: DataTypes.DATE, allowNull: true },
    resolvedAt: { type: DataTypes.DATE, allowNull: true },
    assignedTo: { type: DataTypes.UUID, allowNull: true },
    acknowledgedBy: { type: DataTypes.UUID, allowNull: true },
    acknowledgedAt: { type: DataTypes.DATE, allowNull: true },
    note: { type: DataTypes.STRING(1000), allowNull: false, defaultValue: '' },
    expectedRestockAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'inventory_alerts',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['status', 'severity'], name: 'idx_inventory_alerts_status_severity' },
      { fields: ['assigned_to'], name: 'idx_inventory_alerts_assigned_to' },
    ],
  });

  InventoryAlert.associate = (models) => {
    InventoryAlert.belongsTo(models.Product, { foreignKey: 'productId', as: 'product', onDelete: 'CASCADE' });
    InventoryAlert.belongsTo(models.ProductVariant, { foreignKey: 'variantId', as: 'variant', onDelete: 'SET NULL' });
    InventoryAlert.belongsTo(models.User, { foreignKey: 'assignedTo', as: 'assignee', onDelete: 'SET NULL' });
    InventoryAlert.belongsTo(models.User, { foreignKey: 'acknowledgedBy', as: 'acknowledger', onDelete: 'SET NULL' });
  };

  return InventoryAlert;
};
