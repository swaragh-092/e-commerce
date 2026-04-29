'use strict';

module.exports = (sequelize, DataTypes) => {
    const ShippingRuleHistory = sequelize.define('ShippingRuleHistory', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        ruleId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        changedBy: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        changeType: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        oldValue: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
        newValue: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
        reason: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    }, {
        tableName: 'shipping_rule_history',
        timestamps: true,
        underscored: true,
    });

    ShippingRuleHistory.associate = (models) => {
        ShippingRuleHistory.belongsTo(models.ShippingRule, { foreignKey: 'ruleId', as: 'rule', onDelete: 'SET NULL' });
        ShippingRuleHistory.belongsTo(models.User, { foreignKey: 'changedBy', as: 'actor', onDelete: 'SET NULL' });
    };

    return ShippingRuleHistory;
};
