'use strict';

const { Menu, MenuItem, Page, Category, Product, Sequelize } = require('../index');
const { Op } = Sequelize;
const AppError = require('../../utils/AppError');
const { generateSlug } = require('../../utils/slugify');

const SORT_ORDER = [['sortOrder', 'ASC'], ['createdAt', 'ASC']];

const normalizeEmpty = (value) => (value === '' ? null : value);

const toPlain = (record) => (typeof record?.toJSON === 'function' ? record.toJSON() : record);

const buildTree = (items = []) => {
    const nodes = items.map((item) => ({ ...toPlain(item), children: [] }));
    const byId = new Map(nodes.map((item) => [item.id, item]));
    const roots = [];

    nodes.forEach((item) => {
        if (item.parentId && byId.has(item.parentId)) {
            byId.get(item.parentId).children.push(item);
        } else {
            roots.push(item);
        }
    });

    const sortNodes = (list) => {
        list.sort((a, b) =>
            String(a.placement || '').localeCompare(String(b.placement || '')) ||
            (a.sortOrder || 0) - (b.sortOrder || 0) ||
            String(a.label || '').localeCompare(String(b.label || ''))
        );
        list.forEach((item) => sortNodes(item.children));
    };

    sortNodes(roots);
    return roots;
};

const resolveTreeUrls = async (items) => {
    if (!items.length) return [];

    const targets = { page: new Set(), category: new Set(), product: new Set() };
    const collect = (list) => {
        list.forEach((item) => {
            if (!item.url && item.targetId) {
                const type = item.targetType === 'collection' ? 'category' : item.targetType;
                if (targets[type]) targets[type].add(item.targetId);
            }
            if (item.children?.length) collect(item.children);
        });
    };
    collect(items);

    const [pages, categories, products] = await Promise.all([
        targets.page.size ? Page.findAll({ where: { id: Array.from(targets.page) }, attributes: ['id', 'slug'], raw: true }) : [],
        targets.category.size ? Category.findAll({ where: { id: Array.from(targets.category) }, attributes: ['id', 'slug'], raw: true }) : [],
        targets.product.size ? Product.findAll({ where: { id: Array.from(targets.product) }, attributes: ['id', 'slug'], raw: true }) : [],
    ]);

    const slugMap = {
        page: new Map(pages.map((p) => [p.id, p.slug])),
        category: new Map(categories.map((c) => [c.id, c.slug])),
        collection: new Map(categories.map((c) => [c.id, c.slug])),
        product: new Map(products.map((p) => [p.id, p.slug])),
    };

    const resolve = (list) => list.map((item) => {
        let url = item.url || '#';
        if (!item.url) {
            if (item.targetType === 'system_route') {
                url = item.url || '/';
            } else if (item.targetId) {
                const slug = slugMap[item.targetType]?.get(item.targetId);
                if (slug) {
                    if (item.targetType === 'page') url = `/p/${slug}`;
                    else if (item.targetType === 'category' || item.targetType === 'collection') url = `/products?category=${slug}`;
                    else if (item.targetType === 'product') url = `/products/${slug}`;
                }
            }
        }
        return {
            ...item,
            url,
            children: resolve(item.children || []),
        };
    });

    return resolve(items);
};

const getDescendantIds = async (itemId, menuId, collected = new Set(), options = {}) => {
    const children = await MenuItem.findAll({
        where: { menuId, parentId: itemId },
        attributes: ['id'],
        transaction: options.transaction,
    });

    for (const child of children) {
        if (!collected.has(child.id)) {
            collected.add(child.id);
            await getDescendantIds(child.id, menuId, collected, options);
        }
    }

    return collected;
};

const validateParent = async ({ menuId, itemId = null, parentId }, options = {}) => {
    if (!parentId) return;

    if (parentId === itemId) {
        throw new AppError('INVALID_PARENT', 400, 'A menu item cannot be its own parent');
    }

    const parent = await MenuItem.findOne({
        where: { id: parentId, menuId },
        transaction: options.transaction,
    });
    if (!parent) {
        throw new AppError('INVALID_PARENT', 400, 'Parent item must belong to the same menu');
    }

    if (itemId) {
        const descendants = await getDescendantIds(itemId, menuId, new Set(), options);
        if (descendants.has(parentId)) {
            throw new AppError('INVALID_PARENT', 400, 'A menu item cannot be moved under one of its children');
        }
    }
};

const validateTarget = async ({ targetType, targetId, url }) => {
    if (targetType === 'none') return;

    if (targetType === 'custom_url' || targetType === 'system_route') {
        if (!url) {
            throw new AppError('INVALID_MENU_ITEM', 400, 'URL is required for custom URL and system route menu items');
        }
        return;
    }

    if (['page', 'category', 'collection', 'product'].includes(targetType) && !targetId) {
        throw new AppError('INVALID_MENU_ITEM', 400, 'Target is required for page, category, collection, and product menu items');
    }
};

const sanitizeItemData = (data) => {
    const next = {
        ...data,
        parentId: normalizeEmpty(data.parentId),
        targetId: normalizeEmpty(data.targetId),
        url: normalizeEmpty(data.url),
    };

    if (next.targetType === 'none') {
        next.targetId = null;
        next.url = null;
        next.openInNewTab = false;
    }

    if (next.targetType === 'custom_url' || next.targetType === 'system_route') {
        next.targetId = null;
    }

    return next;
};

exports.getMenus = async ({ location, includeInactive = false } = {}) => {
    const where = {};
    if (location) where.location = location;
    if (!includeInactive) where.isActive = true;

    return Menu.findAll({
        where,
        include: [{ model: MenuItem, as: 'items', required: false }],
        order: [...SORT_ORDER, [{ model: MenuItem, as: 'items' }, 'sortOrder', 'ASC']],
    });
};

exports.getMenuById = async (id) => {
    const menu = await Menu.findByPk(id, {
        include: [{ model: MenuItem, as: 'items', required: false }],
        order: [[{ model: MenuItem, as: 'items' }, 'sortOrder', 'ASC']],
    });
    if (!menu) throw new AppError('NOT_FOUND', 404, 'Menu not found');

    const plain = toPlain(menu);
    return { ...plain, items: buildTree(plain.items || []) };
};

exports.getPublicMenuByLocation = async (location) => {
    if (typeof location !== 'string') throw new AppError('INVALID_INPUT', 400);
    const sanitizedLocation = encodeURIComponent(location).replace(/['"*]/g, '');
    const menus = await Menu.findAll({
        where: { location: sanitizedLocation, isActive: true },
        include: [{
            model: MenuItem,
            as: 'items',
            required: false,
            where: { isVisible: true },
        }],
        order: [...SORT_ORDER, [{ model: MenuItem, as: 'items' }, 'sortOrder', 'ASC']],
    });

    if (!menus.length) return null;

    const plainMenus = menus.map(toPlain);
    const plain = plainMenus.find((candidate) => candidate.items?.length > 0) || plainMenus[0];
    const tree = buildTree(plain.items || []);
    return { ...plain, items: await resolveTreeUrls(tree) };
};

exports.createMenu = async (data) => {
    const slug = data.slug || await generateSlug(data.name, Menu);
    return Menu.create({ ...data, slug });
};

exports.updateMenu = async (id, data) => {
    const menu = await Menu.findByPk(id);
    if (!menu) throw new AppError('NOT_FOUND', 404, 'Menu not found');

    const updates = { ...data };
    if ((updates.name && updates.name !== menu.name) && !updates.slug) {
        updates.slug = await generateSlug(updates.name, Menu);
    }

    await menu.update(updates);
    return exports.getMenuById(id);
};

exports.deleteMenu = async (id) => {
    const menu = await Menu.findByPk(id);
    if (!menu) throw new AppError('NOT_FOUND', 404, 'Menu not found');
    await menu.destroy();
    return true;
};

exports.createMenuItem = async (menuId, data) => {
    const menu = await Menu.findByPk(menuId);
    if (!menu) throw new AppError('NOT_FOUND', 404, 'Menu not found');

    const itemData = sanitizeItemData(data);
    await validateParent({ menuId, parentId: itemData.parentId });
    await validateTarget(itemData);

    const item = await MenuItem.create({ ...itemData, menuId });

    return item;
};

exports.updateMenuItem = async (menuId, itemId, data) => {
    const item = await MenuItem.findOne({ where: { id: itemId, menuId } });
    if (!item) throw new AppError('NOT_FOUND', 404, 'Menu item not found');

    const itemData = sanitizeItemData({
        targetType: item.targetType,
        targetId: item.targetId,
        url: item.url,
        parentId: item.parentId,
        openInNewTab: item.openInNewTab,
        ...data,
    });

    await validateParent({ menuId, itemId, parentId: itemData.parentId });
    await validateTarget(itemData);

    await item.update(itemData);

    return item;
};

exports.deleteMenuItem = async (menuId, itemId) => {
    const item = await MenuItem.findOne({ where: { id: itemId, menuId } });
    if (!item) throw new AppError('NOT_FOUND', 404, 'Menu item not found');
    await MenuItem.destroy({ where: { [Op.or]: [{ id: itemId }, { parentId: itemId }], menuId } });
    return true;
};

exports.reorderItems = async (menuId, items) => {
    const transaction = await MenuItem.sequelize.transaction();
    try {
        for (const item of items) {
            const parentId = normalizeEmpty(item.parentId);
            await validateParent({ menuId, itemId: item.id, parentId }, { transaction });
            await MenuItem.update(
                {
                    sortOrder: item.sortOrder,
                    parentId,
                    ...(item.placement ? { placement: item.placement } : {}),
                },
                { where: { id: item.id, menuId }, transaction }
            );
        }
        await transaction.commit();
        return exports.getMenuById(menuId);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};
