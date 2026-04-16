'use strict';

module.exports = (sequelize, DataTypes) => {
    const Setting = sequelize.define('Setting', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        key: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        value: {
            type: DataTypes.JSONB,
            allowNull: false,
        },
        group: {
            type: DataTypes.STRING(50),
            allowNull: false,
            validate: {
                isIn: [['theme', 'features', 'sales', 'seo', 'general', 'shipping', 'tax', 'sku', 'logo', 'hero', 'footer', 'announcement', 'nav', 'catalog', 'homepage', 'productPage', 'admin', 'invoice']],
            },
        },
        updatedBy: {
            type: DataTypes.UUID,
        },
    }, {
        tableName: 'settings',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['key', 'group'], name: 'settings_key_group_unique' },
        ],
    });

    Setting.associate = (models) => {
        Setting.belongsTo(models.User, { foreignKey: 'updatedBy', as: 'editor' });
    };

    return Setting;
};
