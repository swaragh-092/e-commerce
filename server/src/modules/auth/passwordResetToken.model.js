'use strict';

module.exports = (sequelize, DataTypes) => {
    const PasswordResetToken = sequelize.define('PasswordResetToken', {
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
            allowNull: false,
            unique: true,
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: 'password_reset_tokens',
        timestamps: true,
        underscored: true,
    });

    PasswordResetToken.associate = (models) => {
        PasswordResetToken.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
    };

    return PasswordResetToken;
};
