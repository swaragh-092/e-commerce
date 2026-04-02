'use strict';

module.exports = (sequelize, DataTypes) => {
    const AuditLog = sequelize.define('AuditLog', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
        },
        action: {
            type: DataTypes.STRING(50),
            allowNull: false,
            validate: {
                isIn: [['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE']],
            },
        },
        entity: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        entityId: {
            type: DataTypes.STRING(255),
        },
        changes: {
            type: DataTypes.JSONB,
        },
        ipAddress: {
            type: DataTypes.STRING(50),
        },
        userAgent: {
            type: DataTypes.TEXT,
        },
    }, {
        tableName: 'audit_logs',
        timestamps: true,
        updatedAt: false,
        underscored: true,
        indexes: [
            { fields: ['entity', 'entity_id'] },
            { fields: ['user_id'] },
            { fields: ['created_at'] },
        ],
    });

    AuditLog.associate = (models) => {
        AuditLog.belongsTo(models.User, { foreignKey: 'userId' });
    };

    return AuditLog;
};
