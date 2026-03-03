'use strict';

module.exports = (sequelize, DataTypes) => {
    const UserProfile = sequelize.define('UserProfile', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
            unique: true,
            allowNull: false,
        },
        phone: {
            type: DataTypes.STRING(20),
        },
        avatar: {
            type: DataTypes.STRING(500),
        },
        dateOfBirth: {
            type: DataTypes.DATEONLY,
        },
        gender: {
            type: DataTypes.STRING(20),
            validate: {
                isIn: [['male', 'female', 'other', 'prefer_not_to_say']],
            },
        },
    }, {
        tableName: 'user_profiles',
        timestamps: true,
        underscored: true,
    });

    UserProfile.associate = (models) => {
        UserProfile.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
    };

    return UserProfile;
};
