'use strict';

module.exports = (sequelize, DataTypes) => {
  const ThemeActivation = sequelize.define('ThemeActivation', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    themePackageId: { type: DataTypes.UUID, allowNull: true },
    themeName: { type: DataTypes.STRING(255), allowNull: false },
    themeVersion: { type: DataTypes.STRING(20), allowNull: true },
    appliedScopes: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    beforeSnapshot: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    afterSnapshot: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    dataSourceRefs: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    appliedBy: { type: DataTypes.UUID, allowNull: false },
    rolledBackAt: { type: DataTypes.DATE, allowNull: true },
    rolledBackBy: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'theme_activations',
    timestamps: true,
    underscored: true,
    updatedAt: false,
  });

  ThemeActivation.associate = (models) => {
    ThemeActivation.belongsTo(models.ThemePackage, { foreignKey: 'themePackageId', as: 'themePackage' });
    ThemeActivation.belongsTo(models.User, { foreignKey: 'appliedBy', as: 'appliedByUser' });
    ThemeActivation.belongsTo(models.User, { foreignKey: 'rolledBackBy', as: 'rolledBackByUser' });
  };

  return ThemeActivation;
};
