'use strict';

const { sequelize, Product, ProductComboItem, ProductVariant, ProductImage, Transaction } = require('../index');
const { Op } = require('sequelize');
const AppError = require('../../utils/AppError');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getPrimaryImageUrl = (product = {}) => {
    const images = Array.isArray(product.images) ? product.images : [];
    const img = images.find((i) => i.isPrimary) || images[0];
    return img?.url || null;
};

const ITEM_INCLUDE = [
    {
        model: Product,
        as: 'item',
        attributes: ['id', 'name', 'slug', 'sku', 'price', 'salePrice', 'quantity', 'type', 'status'],
        include: [
            { model: ProductImage, as: 'images', attributes: ['url', 'isPrimary'], required: false },
            { model: ProductVariant, as: 'variants', attributes: ['id', 'sku', 'price', 'stockQty', 'isActive'], required: false },
        ],
    },
    {
        model: ProductVariant,
        as: 'variant',
        attributes: ['id', 'sku', 'price', 'stockQty', 'isActive'],
        required: false,
    },
];

// ─── Service Methods ──────────────────────────────────────────────────────────

/**
 * Return ordered combo items with constituent product/variant detail.
 */
const getComboItems = async (productId) => {
    const product = await Product.findByPk(productId, { attributes: ['id', 'type'] });
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
    if (product.type !== 'combo') {
        throw new AppError('VALIDATION_ERROR', 400, 'Product type must be "combo" to fetch combo items');
    }

    const items = await ProductComboItem.findAll({
        where: { comboProductId: productId },
        include: ITEM_INCLUDE,
        order: [['sortOrder', 'ASC']],
    });

    return items;
};

/**
 * Atomically replace all combo items for a product.
 * Validates:
 *  - Product must exist and be type === 'combo'
 *  - No item may be the combo itself (self-reference)
 *  - No item may be another combo (no nested bundles)
 *  - Max 20 items
 */
const syncComboItems = async (productId, items = []) => {
    return sequelize.transaction(async (t) => {
        const product = await Product.findByPk(productId, { transaction: t, attributes: ['id', 'type', 'name'] });
        if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
        if (product.type !== 'combo') {
            throw new AppError('VALIDATION_ERROR', 400, 'Product type must be "combo" to manage combo items');
        }
        if (items.length > 20) {
            throw new AppError('VALIDATION_ERROR', 400, 'A combo may not contain more than 20 items');
        }

        // Validate constituent products
        if (items.length > 0) {
            const itemProductIds = items.map((i) => i.itemProductId);
            const constituents = await Product.findAll({
                where: { id: itemProductIds },
                attributes: ['id', 'type'],
                transaction: t,
            });

            const constituentMap = Object.fromEntries(constituents.map((p) => [p.id, p]));

            for (const ci of items) {
                if (ci.itemProductId === productId) {
                    throw new AppError('VALIDATION_ERROR', 400, 'A combo cannot contain itself');
                }
                const constituent = constituentMap[ci.itemProductId];
                if (!constituent) {
                    throw new AppError('NOT_FOUND', 404, `Constituent product ${ci.itemProductId} not found`);
                }
                if (constituent.type === 'combo') {
                    throw new AppError('VALIDATION_ERROR', 400, 'Nested combos are not allowed');
                }

                // Ensure quantity > 0
                if (!ci.quantity || ci.quantity <= 0) {
                    throw new AppError('VALIDATION_ERROR', 400, `Quantity for item ${ci.itemProductId} must be greater than 0`);
                }

                // Ensure variant belongs to item product
                if (ci.variantId) {
                    const variantExists = await ProductVariant.findOne({
                        where: { id: ci.variantId, productId: ci.itemProductId },
                        transaction: t,
                        attributes: ['id']
                    });
                    if (!variantExists) {
                        throw new AppError('VALIDATION_ERROR', 400, `Variant ${ci.variantId} does not belong to product ${ci.itemProductId}`);
                    }
                }
            }
        }

        // Full replace — delete existing, insert new
        await ProductComboItem.destroy({ where: { comboProductId: productId }, transaction: t });

        if (items.length === 0) return [];

        const created = await ProductComboItem.bulkCreate(
            items.map((item, i) => ({
                comboProductId: productId,
                itemProductId:  item.itemProductId,
                variantId:      item.variantId || null,
                quantity:       item.quantity,
                sortOrder:      i,
            })),
            { transaction: t }
        );

        // Return full detail
        const ids = created.map((c) => c.id);
        return ProductComboItem.findAll({
            where: { id: ids },
            include: ITEM_INCLUDE,
            order: [['sortOrder', 'ASC']],
            transaction: t,
        });
    });
};

/**
 * Virtual stock: minimum of (constituent_stock / required_qty) across all items.
 * Returns 0 when there are no combo items.
 */
const getVirtualStock = async (productId) => {
    const items = await ProductComboItem.findAll({
        where: { comboProductId: productId },
        include: [
            { model: Product,        as: 'item',    attributes: ['id', 'quantity'] },
            { model: ProductVariant, as: 'variant',  attributes: ['id', 'stockQty'], required: false },
        ],
    });

    if (!items.length) return 0;

    const available = items.reduce((min, ci) => {
        const stock = ci.variantId
            ? Number(ci.variant?.stockQty ?? 0)
            : Number(ci.item?.quantity ?? 0);
        return Math.min(min, Math.floor(stock / ci.quantity));
    }, Infinity);

    return available === Infinity ? 0 : available;
};

/**
 * Suggested retail price = sum of (constituent price × quantity).
 * Returns the raw numeric string (DECIMAL-safe).
 */
const getSuggestedPrice = async (productId) => {
    const items = await ProductComboItem.findAll({
        where: { comboProductId: productId },
        include: [
            { model: Product,        as: 'item',    attributes: ['id', 'price', 'salePrice'] },
            { model: ProductVariant, as: 'variant',  attributes: ['id', 'price'], required: false },
        ],
    });

    const total = items.reduce((sum, ci) => {
        const unitPrice = ci.variantId
            ? Number(ci.variant?.price ?? ci.item?.price ?? 0)
            : Number(ci.item?.price ?? 0);
        return sum + unitPrice * ci.quantity;
    }, 0);

    return Number(total.toFixed(2));
};

/**
 * Build an immutable combo_snapshot array for an order item.
 * Called inside the order placement transaction — passed `transaction`.
 */
const buildComboSnapshot = async (productId, transaction) => {
    const items = await ProductComboItem.findAll({
        where: { comboProductId: productId },
        include: [
            {
                model: Product,
                as: 'item',
                attributes: ['id', 'name', 'sku', 'price'],
                include: [{ model: ProductImage, as: 'images', attributes: ['url', 'isPrimary'], required: false }],
            },
            {
                model: ProductVariant,
                as: 'variant',
                attributes: ['id', 'sku', 'price'],
                required: false,
            },
        ],
        order: [['sortOrder', 'ASC']],
        transaction,
    });

    return items.map((ci) => ({
        productId:     ci.itemProductId,
        variantId:     ci.variantId || null,
        quantity:      ci.quantity,
        snapshotName:  ci.item.name,
        snapshotSku:   ci.variant?.sku || ci.item.sku || null,
        snapshotPrice: String(ci.variant?.price ?? ci.item.price ?? '0.00'),
        snapshotImage: getPrimaryImageUrl(ci.item),
    }));
};

/**
 * Validate that all combo constituents have enough stock for `orderQty` bundles.
 * Throws 409 STOCK_CONFLICT on the first insufficient item.
 * Call this inside the order placement transaction with lock: UPDATE.
 */
const validateComboStock = async (productId, orderQty, transaction) => {
    const items = await ProductComboItem.findAll({
        where: { comboProductId: productId },
        include: [
            {
                model: Product,
                as: 'item',
                attributes: ['id', 'name', 'quantity'],
                lock: transaction ? { level: Transaction.LOCK.UPDATE, of: Product } : undefined,
            },
            {
                model: ProductVariant,
                as: 'variant',
                attributes: ['id', 'stockQty'],
                required: false,
                lock: transaction ? { level: Transaction.LOCK.UPDATE, of: ProductVariant } : undefined,
            },
        ],
        transaction,
    });

    for (const ci of items) {
        const available = ci.variantId
            ? Number(ci.variant?.stockQty ?? 0)
            : Number(ci.item?.quantity ?? 0);
        const required = ci.quantity * orderQty;

        if (available < required) {
            throw new AppError(
                'STOCK_CONFLICT',
                409,
                `Insufficient stock for "${ci.item.name}" (need ${required}, have ${available})`
            );
        }
    }
};

/**
 * Atomically deduct stock from all combo constituents after order placement.
 * Uses Sequelize.literal for atomic DB-level decrement.
 */
const deductComboStock = async (productId, orderQty, transaction) => {
    const items = await ProductComboItem.findAll({
        where: { comboProductId: productId },
        transaction,
    });

    for (const ci of items) {
        const deduct = ci.quantity * orderQty;
        if (ci.variantId) {
            await ProductVariant.update(
                { stockQty: sequelize.literal(`GREATEST(stock_qty - ${deduct}, 0)`) },
                { where: { id: ci.variantId, stockQty: { [Op.gte]: deduct } }, transaction }
            );
        } else {
            await Product.update(
                { quantity: sequelize.literal(`GREATEST(quantity - ${deduct}, 0)`) },
                { where: { id: ci.itemProductId, quantity: { [Op.gte]: deduct } }, transaction }
            );
        }
    }
};

module.exports = {
    getComboItems,
    syncComboItems,
    getVirtualStock,
    getSuggestedPrice,
    buildComboSnapshot,
    validateComboStock,
    deductComboStock,
};
