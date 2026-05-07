'use strict';

module.exports = (sequelize, DataTypes) => {
    const MenuItem = sequelize.define('MenuItem', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        menuId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'menu_id',
        },
        parentId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'parent_id',
        },
        label: {
            type: DataTypes.STRING(120),
            allowNull: false,
        },
        targetType: {
            type: DataTypes.STRING(30),
            allowNull: false,
            defaultValue: 'custom_url',
            field: 'target_type',
        },
        targetId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'target_id',
        },
        url: {
            type: DataTypes.STRING(1000),
            allowNull: true,
        },
        placement: {
            type: DataTypes.STRING(40),
            allowNull: false,
            defaultValue: 'center',
        },
        sortOrder: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: 'sort_order',
        },
        isVisible: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            field: 'is_visible',
        },
        openInNewTab: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            field: 'open_in_new_tab',
        },
    }, {
        tableName: 'menu_items',
        timestamps: true,
        underscored: true,
        paranoid: true,
    });

    MenuItem.associate = (models) => {
        MenuItem.belongsTo(models.Menu, { foreignKey: 'menuId', as: 'menu' });
        MenuItem.belongsTo(models.MenuItem, { foreignKey: 'parentId', as: 'parent', onDelete: 'CASCADE' });
        MenuItem.hasMany(models.MenuItem, { foreignKey: 'parentId', as: 'children' });
    };

    return MenuItem;
};
