'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('GuestOrderClaimToken', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    usedAt: { type: DataTypes.DATE, allowNull: true },
}, {
    tableName: 'guest_order_claim_tokens',
    timestamps: true,
    underscored: true,
});
