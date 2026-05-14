'use strict';

module.exports = (sequelize, DataTypes) => {
  const ApiDefinition = sequelize.define('ApiDefinition', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(140),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(140),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    config: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by',
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'updated_by',
    },
  }, {
    tableName: 'api_definitions',
    timestamps: true,
    underscored: true,
    paranoid: true,
  });

  ApiDefinition.associate = (models) => {
    ApiDefinition.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
    ApiDefinition.belongsTo(models.User, { foreignKey: 'updatedBy', as: 'updater' });
  };

  return ApiDefinition;
};
