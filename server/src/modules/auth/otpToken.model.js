'use strict';

module.exports = (sequelize, DataTypes) => {
  const OtpToken = sequelize.define('OtpToken', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    identifier: { type: DataTypes.STRING(100), allowNull: false },
    otpHash: { type: DataTypes.STRING(64), allowNull: false },
    purpose: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'login' },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    maxAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    createdByIp: { type: DataTypes.STRING(100) },
  }, {
    tableName: 'otp_tokens',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  });

  return OtpToken;
};
