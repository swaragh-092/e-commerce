'use strict';

module.exports = (sequelize, DataTypes) => {
    const NotificationTemplate = sequelize.define('NotificationTemplate', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(100),
            unique: true,
            allowNull: false,
        },
        subject: {
            type: DataTypes.STRING(500),
            allowNull: false,
        },
        bodyHtml: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        bodyText: {
            type: DataTypes.TEXT,
        },
        bodySms: {
            type: DataTypes.TEXT,
        },
        bodyWhatsapp: {
            type: DataTypes.TEXT,
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        enableEmail: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        enableSms: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        enableWhatsapp: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    }, {
        tableName: 'notification_templates',
        timestamps: true,
        underscored: true,
    });

    return NotificationTemplate;
};
