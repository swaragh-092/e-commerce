'use strict';

module.exports = (sequelize, DataTypes) => {
    const Address = sequelize.define('Address', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        label: {
            type: DataTypes.STRING(50),
        },
        fullName: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        phone: {
            type: DataTypes.STRING(20),
        },
        addressLine1: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        addressLine2: {
            type: DataTypes.STRING(255),
        },
        city: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        state: {
            type: DataTypes.STRING(100),
        },
        postalCode: {
            type: DataTypes.STRING(20),
            allowNull: false,
        },
        country: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        isDefault: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    }, {
        tableName: 'addresses',
        timestamps: true,
        underscored: true,
    });

    Address.associate = (models) => {
        Address.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
    };

    return Address;
};
