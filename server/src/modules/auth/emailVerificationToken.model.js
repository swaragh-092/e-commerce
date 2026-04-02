'use strict';

module.exports = (sequelize, DataTypes) => {
    const EmailVerificationToken = sequelize.define('EmailVerificationToken', {
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
        tableName: 'email_verification_tokens',
        timestamps: true,
        underscored: true,
    });

    EmailVerificationToken.associate = (models) => {
        EmailVerificationToken.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
    };

    return EmailVerificationToken;
};
