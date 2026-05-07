'use strict';

module.exports = (sequelize, DataTypes) => {
    const Menu = sequelize.define('Menu', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(120),
            allowNull: false,
        },
        slug: {
            type: DataTypes.STRING(120),
            allowNull: false,
            unique: true,
        },
        location: {
            type: DataTypes.STRING(40),
            allowNull: false,
            defaultValue: 'header',
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            field: 'is_active',
        },
        sortOrder: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: 'sort_order',
        },
    }, {
        tableName: 'menus',
        timestamps: true,
        underscored: true,
        paranoid: true,
    });

    Menu.associate = (models) => {
        Menu.hasMany(models.MenuItem, { foreignKey: 'menuId', as: 'items', onDelete: 'CASCADE' });
    };

    return Menu;
};
