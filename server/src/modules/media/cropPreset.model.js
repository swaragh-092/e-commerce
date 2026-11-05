'use strict';
module.exports = (sequelize, DataTypes) => sequelize.define('CropPreset', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(60), allowNull: false },
  normalizedName: { type: DataTypes.STRING(60), allowNull: false },
  width: { type: DataTypes.INTEGER, allowNull: false },
  height: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'media_crop_presets', timestamps: true, underscored: true, paranoid: true });
