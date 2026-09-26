'use strict';

module.exports = (sequelize, DataTypes) => {
  const DesignDraftVersion = sequelize.define('DesignDraftVersion', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    draftKey: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'store' },
    revision: { type: DataTypes.INTEGER, allowNull: false },
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    publishedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    publishedBy: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'design_draft_versions',
    timestamps: true,
    underscored: true,
    updatedAt: false,
  });

  DesignDraftVersion.associate = (models) => {
    DesignDraftVersion.belongsTo(models.User, { foreignKey: 'publishedBy', as: 'publisher' });
  };

  return DesignDraftVersion;
};
