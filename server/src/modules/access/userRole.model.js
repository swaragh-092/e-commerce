'use strict';

module.exports = (sequelize, DataTypes) => {
  return sequelize.define('UserRole', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    roleId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'role_id',
    },
  }, {
    tableName: 'user_roles',
    timestamps: true,
    underscored: true,
  });
};