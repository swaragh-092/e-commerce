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
            unique: true,
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
                isIn: [['theme', 'features', 'seo', 'general', 'shipping', 'tax', 'sku', 'logo', 'hero', 'footer']],
            },
        },
        updatedBy: {
            type: DataTypes.UUID,
        },
    }, {
        tableName: 'settings',
        timestamps: true,
        underscored: true,
    });

    Setting.associate = (models) => {
        Setting.belongsTo(models.User, { foreignKey: 'updatedBy', as: 'editor' });
    };

    return Setting;
};
