'use strict';

module.exports = (sequelize, DataTypes) => {
  const InventoryAlertConfig = sequelize.define('InventoryAlertConfig', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    configKey: { type: DataTypes.STRING(40), allowNull: false, unique: true, defaultValue: 'store' },
    recipientUserIds: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    timezone: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'Asia/Kolkata' },
    digestHour: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 9 },
    reminderIntervalDays: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 1 },
    immediateOutOfStock: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    includeEnvironmentRecipients: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    updatedBy: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'inventory_alert_configs',
    timestamps: true,
    underscored: true,
  });

  InventoryAlertConfig.associate = (models) => {
    InventoryAlertConfig.belongsTo(models.User, { foreignKey: 'updatedBy', as: 'editor', onDelete: 'SET NULL' });
  };

  return InventoryAlertConfig;
};
