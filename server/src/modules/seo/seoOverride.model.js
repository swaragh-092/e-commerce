'use strict';

module.exports = (sequelize, DataTypes) => {
    const SeoOverride = sequelize.define('SeoOverride', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        path: {
            type: DataTypes.STRING(255),
            unique: true,
            allowNull: false,
        },
        metaTitle: {
            type: DataTypes.STRING(255),
            field: 'meta_title'
        },
        metaDescription: {
            type: DataTypes.TEXT,
            field: 'meta_description'
        },
        metaKeywords: {
            type: DataTypes.STRING(500),
            field: 'meta_keywords'
        },
        ogImage: {
            type: DataTypes.STRING(500),
            field: 'og_image'
        },
        canonicalUrl: {
            type: DataTypes.STRING(500),
            field: 'canonical_url'
        },
        noIndex: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'no_index'
        },
    }, {
        tableName: 'seo_overrides',
        timestamps: true,
        underscored: true,
    });

    SeoOverride.associate = (models) => {
        // No direct associations needed for now
    };

    return SeoOverride;
};
