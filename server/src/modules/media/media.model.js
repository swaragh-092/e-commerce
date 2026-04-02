'use strict';

module.exports = (sequelize, DataTypes) => {
    const Media = sequelize.define('Media', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        url: {
            type: DataTypes.STRING(500),
            allowNull: false,
        },
        filename: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        mimeType: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        size: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        provider: {
            type: DataTypes.STRING(50),
            defaultValue: 'local',
        },
    }, {
        tableName: 'media',
        timestamps: true,
        underscored: true,
    });

    Media.associate = (models) => {
        Media.hasMany(models.ProductImage, { foreignKey: 'mediaId', as: 'productImages' });
    };

    return Media;
};
