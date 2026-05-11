'use strict';

const sanitizeHtml = require('sanitize-html');
const { ProductTab, Product, Sequelize } = require('../index');
const AppError = require('../../utils/AppError');

// ─── HTML Sanitizer ─────────────────────────────────────────────────────────
// Allow a rich subset of HTML tags so product tabs can contain formatted text,
// lists, tables, and inline images. Dangerous tags (script, style, iframe, …)
// and unsafe attributes are stripped by sanitize-html.
const sanitizeRichText = (html) => {
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
            '*': ['class', 'style'],
        },
        allowedSchemes: ['http', 'https', 'mailto', 'tel'],
        allowedSchemesByTag: {
            img: ['http', 'https'],
        },
    });
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const assertProductExists = async (productId) => {
    const product = await Product.findByPk(productId, { attributes: ['id'] });
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
};

// ─── Service Exports ─────────────────────────────────────────────────────────

/**
 * Return all tabs for a product, ordered by sort_order ASC.
 */
exports.getTabsForProduct = async (productId) => {
    await assertProductExists(productId);

    return ProductTab.findAll({
        where: { productId },
        order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']],
    });
};

/**
 * Create a single tab for a product.
 */
exports.createTab = async (productId, data) => {
    await assertProductExists(productId);

    const tab = await ProductTab.create({
        productId,
        title: data.title,
        content: sanitizeRichText(data.content),
        type: data.type ?? 'html',
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
    });

    return tab;
};

/**
 * Update a single tab. Partial updates are supported.
 */
exports.updateTab = async (productId, tabId, data) => {
    await assertProductExists(productId);

    const tab = await ProductTab.findOne({ where: { id: tabId, productId } });
    if (!tab) throw new AppError('NOT_FOUND', 404, 'Tab not found');

    const updates = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.content !== undefined) updates.content = sanitizeRichText(data.content);
    if (data.type !== undefined) updates.type = data.type;
    if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    await tab.update(updates);
    return tab.reload();
};

/**
 * Delete a single tab.
 */
exports.deleteTab = async (productId, tabId) => {
    await assertProductExists(productId);

    const tab = await ProductTab.findOne({ where: { id: tabId, productId } });
    if (!tab) throw new AppError('NOT_FOUND', 404, 'Tab not found');

    await tab.destroy();
    return true;
};

/**
 * Reorder tabs: accepts an array of { id, sortOrder } and persists them
 * atomically inside a transaction. All tab IDs must belong to the product.
 */
exports.reorderTabs = async (productId, order) => {
    await assertProductExists(productId);

    const ids = order.map((o) => o.id);
    const existing = await ProductTab.findAll({
        where: { id: ids, productId },
        attributes: ['id'],
    });

    if (existing.length !== ids.length) {
        throw new AppError('VALIDATION_ERROR', 400, 'One or more tab IDs do not belong to this product');
    }

    const transaction = await ProductTab.sequelize.transaction();
    try {
        await Promise.all(
            order.map(({ id, sortOrder }) =>
                ProductTab.update({ sortOrder }, { where: { id, productId }, transaction })
            )
        );
        await transaction.commit();
    } catch (err) {
        await transaction.rollback();
        throw err;
    }

    return exports.getTabsForProduct(productId);
};

/**
 * Full sync: replace ALL tabs for a product with the provided array.
 * Performs an upsert strategy inside a single transaction:
 *   - Tabs with an `id` are updated.
 *   - Tabs without an `id` are inserted.
 *   - Tabs not present in the payload are deleted.
 */
exports.syncTabs = async (productId, tabs) => {
    await assertProductExists(productId);

    const transaction = await ProductTab.sequelize.transaction();
    try {
        const incomingIds = tabs.filter((t) => t.id).map((t) => t.id);

        // Delete tabs that are no longer in the payload
        await ProductTab.destroy({
            where: {
                productId,
                ...(incomingIds.length
                    ? { id: { [Sequelize.Op.notIn]: incomingIds } }
                    : {}),
            },
            transaction,
        });

        // Upsert each tab
        for (let i = 0; i < tabs.length; i++) {
            const tab = tabs[i];
            const sanitized = sanitizeRichText(tab.content);
            const payload = {
                productId,
                title: tab.title,
                content: sanitized,
                type: tab.type ?? 'html',
                sortOrder: tab.sortOrder ?? i,
                isActive: tab.isActive ?? true,
            };

            if (tab.id) {
                const [affectedCount] = await ProductTab.update(payload, {
                    where: { id: tab.id, productId },
                    transaction,
                });
                if (affectedCount === 0) {
                    throw new AppError('NOT_FOUND', 404, `Tab with ID ${tab.id} not found or doesn't belong to product`);
                }
            } else {
                await ProductTab.create(payload, { transaction });
            }
        }

        await transaction.commit();
    } catch (err) {
        await transaction.rollback();
        throw err;
    }

    return exports.getTabsForProduct(productId);
};
