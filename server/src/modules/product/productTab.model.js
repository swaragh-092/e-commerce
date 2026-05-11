'use strict';

module.exports = (sequelize, DataTypes) => {
    const ProductTab = sequelize.define('ProductTab', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        productId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'product_id',
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        // Rich-text HTML — always sanitized before storage
        content: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        // Reserved for future use (e.g. 'html' | 'shortcode')
        type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'html',
        },
        sortOrder: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: 'sort_order',
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            field: 'is_active',
        },
    }, {
        tableName: 'product_tabs',
        timestamps: true,
        underscored: true,
        hooks: {
            beforeCreate: (tab) => {
                if (tab.content) tab.content = sequelize.models.ProductTab.sanitize(tab.content);
            },
            beforeUpdate: (tab) => {
                if (tab.changed('content') && tab.content) {
                    tab.content = sequelize.models.ProductTab.sanitize(tab.content);
                }
            },
        }
    });

    ProductTab.sanitize = (html) => {
        const sanitizeHtml = require('sanitize-html');
        if (!html) return html;
        return sanitizeHtml(html, {
            allowedTags: [
                'b', 'i', 'em', 'strong', 'u', 'strike', 'del', 's',
                'a', 'p', 'br', 'hr',
                'ul', 'ol', 'li',
                'h2', 'h3', 'h4', 'h5', 'h6',
                'blockquote', 'pre', 'code',
                'table', 'thead', 'tbody', 'tr', 'th', 'td',
                'img', 'figure', 'figcaption',
                'div', 'span',
            ],
            allowedAttributes: {
                a: ['href', 'target', 'rel'],
                img: ['src', 'alt', 'width', 'height'],
                table: ['border', 'cellpadding', 'cellspacing'],
                th: ['colspan', 'rowspan'],
                td: ['colspan', 'rowspan'],
                '*': ['class'], // Removed 'style'
            },
            allowedSchemes: ['http', 'https', 'mailto', 'tel'],
            allowedSchemesByTag: {
                img: ['http', 'https'],
            },
        });
    };

    ProductTab.associate = (models) => {
        ProductTab.belongsTo(models.Product, {
            foreignKey: 'productId',
            as: 'product',
            onDelete: 'CASCADE',
        });
    };

    return ProductTab;
};
