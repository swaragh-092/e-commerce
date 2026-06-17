'use strict';

module.exports = (sequelize, DataTypes) => {
  const ThemePackage = sequelize.define('ThemePackage', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    slug: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    version: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '1.0.0' },
    author: { type: DataTypes.STRING(255), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    category: { type: DataTypes.STRING(50), allowNull: true },
    tags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    previewImage: { type: DataTypes.TEXT, allowNull: true },
    packageData: { type: DataTypes.JSONB, allowNull: false },
    source: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'imported' },
    createdBy: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'theme_packages',
    timestamps: true,
    underscored: true,
  });

  ThemePackage.associate = (models) => {
    ThemePackage.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
    ThemePackage.hasMany(models.ThemeActivation, { foreignKey: 'themePackageId', as: 'activations' });
  };

  return ThemePackage;
};
