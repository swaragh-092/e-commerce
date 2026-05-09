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
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        originalName: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        alt: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        caption: {
            type: DataTypes.STRING(255),
            allowNull: true,
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
