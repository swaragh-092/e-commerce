'use strict';

module.exports = (sequelize, DataTypes) => {
  const Permission = sequelize.define('Permission', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    group: {
      type: DataTypes.STRING(60),
      allowNull: false,
      field: 'permission_group',
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  }, {
    tableName: 'permissions',
    timestamps: true,
    underscored: true,
  });

  Permission.associate = (models) => {
    Permission.belongsToMany(models.Role, {
      through: models.RolePermission,
      foreignKey: 'permissionId',
      otherKey: 'roleId',
      as: 'roles',
    });
  };

  return Permission;
};