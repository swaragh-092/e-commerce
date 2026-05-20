'use strict';

module.exports = (sequelize, DataTypes) => {
    const OrderItem = sequelize.define('OrderItem', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        orderId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        productId: {
            type: DataTypes.UUID,
        },
        snapshotName: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        snapshotPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        snapshotImage: {
            type: DataTypes.STRING(500),
        },
        snapshotSku: {
            type: DataTypes.STRING(100),
        },
        variantInfo: {
            type: DataTypes.JSONB,
        },
        variantId: {
            type: DataTypes.UUID,
            allowNull: true,
            defaultValue: null,
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        total: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        taxBreakdown: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: null,
        },
        // Flags this order item as a combo/bundle product
        isCombo: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        // Immutable snapshot of child products captured at order time — never updated post-order.
        // Shape: Array<{ productId, variantId, quantity, snapshotName, snapshotSku, snapshotPrice, snapshotImage }>
        comboSnapshot: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: null,
            validate: {
                isConsistent(value) {
                    if (this.isCombo) {
                        if (!Array.isArray(value) || value.length === 0) {
                            throw new Error('Combo snapshot must be a non-empty array when isCombo is true');
                        }
                        value.forEach((item, idx) => {
                            const required = ['productId', 'quantity', 'snapshotName', 'snapshotPrice'];
                            required.forEach(field => {
                                if (!item[field]) throw new Error(`Combo item at index ${idx} is missing required field: ${field}`);
                            });
                        });
                    } else if (value !== null) {
                        throw new Error('Combo snapshot must be null when isCombo is false');
                    }
                }
            }
        },
    }, {
        tableName: 'order_items',
        timestamps: true,
        updatedAt: false,
        underscored: true,
    });

    OrderItem.associate = (models) => {
        OrderItem.belongsTo(models.Order, { foreignKey: 'orderId', onDelete: 'CASCADE' });
        OrderItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
        OrderItem.belongsTo(models.ProductVariant, { foreignKey: 'variantId', as: 'variant', constraints: false });
        OrderItem.hasMany(models.FulfillmentItem, { foreignKey: 'orderItemId', as: 'fulfillmentItems' });
        OrderItem.hasMany(models.ShipmentItem, { foreignKey: 'orderItemId', as: 'shipmentItems' });
        OrderItem.hasMany(models.OrderReturnItem, { foreignKey: 'orderItemId', as: 'returnItems' });
        OrderItem.hasMany(models.InventoryTransaction, { foreignKey: 'orderItemId', as: 'inventoryTransactions' });
    };

    return OrderItem;
};
