'use strict';

module.exports = (sequelize, DataTypes) => {
  const DesignDraft = sequelize.define('DesignDraft', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    draftKey: { type: DataTypes.STRING(50), allowNull: false, unique: true, defaultValue: 'store' },
    revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'draft', validate: { isIn: [['draft', 'published']] } },
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    baseSnapshot: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    createdBy: { type: DataTypes.UUID, allowNull: true },
    updatedBy: { type: DataTypes.UUID, allowNull: true },
    publishedAt: { type: DataTypes.DATE, allowNull: true },
    publishedBy: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'design_drafts',
    timestamps: true,
    underscored: true,
  });

  DesignDraft.associate = (models) => {
    DesignDraft.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
    DesignDraft.belongsTo(models.User, { foreignKey: 'updatedBy', as: 'updater' });
    DesignDraft.belongsTo(models.User, { foreignKey: 'publishedBy', as: 'publisher' });
  };

  return DesignDraft;
};
