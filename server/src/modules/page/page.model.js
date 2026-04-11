'use strict';

module.exports = (sequelize, DataTypes) => {
    const Page = sequelize.define('Page', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        slug: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        linkPosition: {
            type: DataTypes.STRING(20),
            defaultValue: 'none',
            allowNull: false,
            field: 'link_position'
        },
        linkPlacement: {
            type: DataTypes.STRING(50),
            allowNull: true,
            field: 'link_placement'
        },
        metaTitle: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'meta_title'
        },
        metaDescription: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'meta_description'
        },
        bannerUrl: {
            type: DataTypes.STRING(1000),
            allowNull: true,
            field: 'banner_url'
        },
        status: {
            type: DataTypes.ENUM('draft', 'published'),
            defaultValue: 'draft',
            allowNull: false,
        },
        isSystem: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false,
            field: 'is_system'
        },
        sortOrder: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
            field: 'sort_order'
        }
    }, {
        tableName: 'pages',
        timestamps: true,
        underscored: true,
        paranoid: true,
    });

    Page.associate = (models) => {
        // Add associations if needed in the future
    };

    return Page;
};
