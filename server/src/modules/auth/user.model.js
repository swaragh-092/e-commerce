'use strict';
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        email: {
            type: DataTypes.STRING(255),
            unique: true,
            allowNull: false,
            validate: { isEmail: true },
        },
        password: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        firstName: {
            type: DataTypes.STRING(100),
        },
        lastName: {
            type: DataTypes.STRING(100),
        },
        role: {
            type: DataTypes.STRING(20),
            defaultValue: 'customer',
            validate: {
                isIn: [['super_admin', 'admin', 'customer']],
            },
        },
        status: {
            type: DataTypes.STRING(20),
            defaultValue: 'active',
            validate: {
                isIn: [['active', 'inactive', 'banned']],
            },
        },
        emailVerified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        lastLoginAt: {
            type: DataTypes.DATE,
        },
    }, {
        tableName: 'users',
        timestamps: true,
        underscored: true,
        paranoid: true, // soft delete
        defaultScope: {
            attributes: { exclude: ['password'] },
        },
        scopes: {
            withPassword: {
                attributes: {},
            },
        },
        hooks: {
            beforeCreate: async (user) => {
                if (user.password) {
                    user.password = await bcrypt.hash(user.password, 12);
                }
            },
            beforeUpdate: async (user) => {
                if (user.changed('password')) {
                    user.password = await bcrypt.hash(user.password, 12);
                }
            },
        },
    });

    User.prototype.validatePassword = async function (password) {
        if (!this.password) return false;
        return await bcrypt.compare(password, this.password);
    };

    User.associate = (models) => {
        User.hasOne(models.UserProfile, { foreignKey: 'userId', as: 'profile', onDelete: 'CASCADE' });
        User.hasMany(models.RefreshToken, { foreignKey: 'userId', onDelete: 'CASCADE' });
        User.hasMany(models.Address, { foreignKey: 'userId', onDelete: 'CASCADE' });
        User.hasMany(models.Order, { foreignKey: 'userId' });
        User.hasMany(models.Review, { foreignKey: 'userId', onDelete: 'CASCADE' });
        User.hasOne(models.Wishlist, { foreignKey: 'userId', onDelete: 'CASCADE' });
        User.hasOne(models.Cart, { foreignKey: 'userId', onDelete: 'CASCADE' });
    };

    return User;
};
