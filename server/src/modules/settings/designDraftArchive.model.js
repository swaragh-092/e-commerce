'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('DesignDraftArchive', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  draftKey: { type: DataTypes.STRING(50), allowNull: false },
  revision: { type: DataTypes.INTEGER, allowNull: false },
  payload: { type: DataTypes.JSONB, allowNull: false },
  baseSnapshot: { type: DataTypes.JSONB, allowNull: false },
  archivedBy: { type: DataTypes.UUID, allowNull: true },
}, { tableName: 'design_draft_archives', timestamps: true, underscored: true });
