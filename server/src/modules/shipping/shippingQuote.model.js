'use strict';

module.exports = (sequelize, DataTypes) => {
    const ShippingQuote = sequelize.define('ShippingQuote', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        addressId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        providerId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        ruleId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        serviceable: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        shippingCost: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        currency: {
            type: DataTypes.STRING(10),
            defaultValue: 'INR',
        },
        taxIncluded: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        taxAmount: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        taxBreakdown: {
            type: DataTypes.JSONB,
            defaultValue: null,
        },
        codAvailable: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        estimatedMinDays: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        estimatedMaxDays: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        checkoutSessionId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        cartHash: {
            type: DataTypes.STRING(64),
            allowNull: false,
        },
        addressHash: {
            type: DataTypes.STRING(64),
            allowNull: false,
        },
        paymentMethod: {
            type: DataTypes.STRING(20),
            allowNull: false,
        },
        couponHash: {
            type: DataTypes.STRING(64),
            allowNull: false,
        },
        idempotencyKey: {
            type: DataTypes.STRING(64),
            allowNull: false,
            unique: true,
        },
        inputSnapshot: {
            type: DataTypes.JSONB,
            defaultValue: {},
        },
        decisionSnapshot: {
            type: DataTypes.JSONB,
            defaultValue: {},
        },
        rawResponse: {
            type: DataTypes.JSONB,
            defaultValue: null,
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: 'shipping_quotes',
        timestamps: true,
        underscored: true,
    });

    ShippingQuote.associate = (models) => {
        ShippingQuote.belongsTo(models.User, { foreignKey: 'userId' });
        ShippingQuote.belongsTo(models.Address, { foreignKey: 'addressId' });
        ShippingQuote.belongsTo(models.ShippingProvider, { foreignKey: 'providerId', as: 'provider' });
        ShippingQuote.belongsTo(models.ShippingRule, { foreignKey: 'ruleId', as: 'rule' });
    };

    return ShippingQuote;
};
