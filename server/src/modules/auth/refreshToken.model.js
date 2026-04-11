'use strict';

module.exports = (sequelize, DataTypes) => {
    const RefreshToken = sequelize.define('RefreshToken', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        token: {
            type: DataTypes.STRING(500),
            unique: true,
            allowNull: false,
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
            createdByIp: {
                type: DataTypes.STRING(100),
                allowNull: true,
                field: 'created_by_ip',
            },
            revokedAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'revoked_at',
            },
    }, {
        tableName: 'refresh_tokens',
        timestamps: true,
        updatedAt: false,
        underscored: true,
    });

    RefreshToken.associate = (models) => {
        RefreshToken.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
    };

    return RefreshToken;
};
