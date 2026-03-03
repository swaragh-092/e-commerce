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
