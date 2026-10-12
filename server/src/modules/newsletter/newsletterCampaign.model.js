'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('NewsletterCampaign', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  subject: { type: DataTypes.STRING(200), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'draft' },
  scheduledAt: { type: DataTypes.DATE },
  queuedAt: { type: DataTypes.DATE },
  createdBy: { type: DataTypes.UUID },
  recipientCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'newsletter_campaigns', timestamps: true, underscored: true });
