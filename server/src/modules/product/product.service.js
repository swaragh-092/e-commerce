'use strict';

const { Product, ProductImage, ProductVariant, Tag, Category, Sequelize } = require('../index');
const { Op } = Sequelize;
const { generateSlug } = require('../../utils/slugify');
const { getPagination, getPagingData } = require('../../utils/pagination');
const sanitizeHtml = require('sanitize-html');
const AuditService = require('../audit/audit.service');
const AppError = require('../../utils/AppError');
const { ACTIONS, ENTITIES } = require('../../config/constants');

const sanitizeRichText = (html) => {
    if (!html) return html;
    return sanitizeHtml(html, {
        allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'img'],
        allowedAttributes: { 'a': ['href'], 'img': ['src', 'alt'] }
    });
};

exports.getProducts = async (filters, page, limit) => {
    const { limit: queryLimit, offset } = getPagination(page, limit);
    const where = {};
    const order = [];

    // Filter Logic
    if (filters.search) {
        where[Op.or] = [
            { name: { [Op.iLike]: `%${filters.search}%` } },
            { description: { [Op.iLike]: `%${filters.search}%` } }
        ];
    }
    if (filters.minPrice || filters.maxPrice) {
        where.price = {};
        if (filters.minPrice) where.price[Op.gte] = filters.minPrice;
        if (filters.maxPrice) where.price[Op.lte] = filters.maxPrice;
    }
    if (filters.status) where.status = filters.status;
    
    // Sort logic
    if (filters.sort === 'price_asc') order.push(['price', 'ASC']);
    else if (filters.sort === 'price_desc') order.push(['price', 'DESC']);
    else if (filters.sort === 'newest') order.push(['createdAt', 'DESC']);
    else if (filters.sort === 'name_asc') order.push(['name', 'ASC']);
    else order.push(['createdAt', 'DESC']); // Default
    
    // Include Logic
    const include = [
        { model: ProductImage, as: 'images' },
        { model: ProductVariant, as: 'variants' },
        { model: Tag, as: 'tags' },
    ];
    
    if (filters.category) {
        include.push({
            model: Category,
            as: 'categories',
            where: { slug: filters.category },
            required: true // INNER JOIN to filter products by category
        });
    } else {
        include.push({
            model: Category,
            as: 'categories',
        });
    }

    const { rows, count } = await Product.findAndCountAll({
        where,
        limit: queryLimit,
        offset,
        order,
        include,
        distinct: true 
    });

    return getPagingData(rows, count, page, queryLimit);
};

exports.getProductBySlug = async (slug) => {
    const product = await Product.findOne({
        where: { slug },
        include: [
            { model: ProductImage, as: 'images' },
            { model: ProductVariant, as: 'variants' },
            { model: Category, as: 'categories' },
            { model: Tag, as: 'tags' }
        ]
    });
    if (!product) throw new Error('Product not found');
    return product;
};

exports.createProduct = async (data) => {
    const transaction = await Product.sequelize.transaction();
    try {
        const slug = await generateSlug(data.name, Product);
        
        if (data.description) data.description = sanitizeRichText(data.description);
        
        const product = await Product.create({ ...data, slug }, { transaction });

        if (data.categoryIds && data.categoryIds.length) {
            await product.setCategories(data.categoryIds, { transaction });
        }
        
        if (data.variants && data.variants.length) {
            const tempVariants = data.variants.map(v => ({...v, productId: product.id}));
            await ProductVariant.bulkCreate(tempVariants, { transaction });
        }
        
        if (data.images && data.images.length) {
            const tempImgs = data.images.map(img => ({...img, productId: product.id}));
            await ProductImage.bulkCreate(tempImgs, { transaction });
        }
        
        if (data.tags && data.tags.length) {
            const tagInstances = await Promise.all(data.tags.map(async (tagName) => {
                const tagSlug = await generateSlug(tagName, Tag);
                const [tag] = await Tag.findOrCreate({ where: { name: tagName }, defaults: { slug: tagSlug }, transaction });
                return tag;
            }));
            await product.setTags(tagInstances, { transaction });
        }

        await transaction.commit();

        // Audit log — fire-and-forget, never crashes creation
        try {
            await AuditService.log({
                userId: data.createdBy || null,
                action: ACTIONS.CREATE,
                entity: ENTITIES.PRODUCT,
                entityId: product.id,
                changes: { name: product.name, sku: product.sku }
            });
        } catch(e) {}

        return exports.getProductBySlug(slug);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

exports.updateProduct = async (id, data) => {
    const product = await Product.findByPk(id);
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
    
    const transaction = await Product.sequelize.transaction();
    try {
        if (data.name && data.name !== product.name) {
            data.slug = await generateSlug(data.name, Product);
        }
        
        if (data.description) data.description = sanitizeRichText(data.description);
        
        await product.update(data, { transaction });

        if (data.categoryIds) {
            await product.setCategories(data.categoryIds, { transaction });
        }

        if (data.variants) {
            await ProductVariant.destroy({ where: { productId: id }, transaction });
            const tempVariants = data.variants.map(v => ({...v, productId: id}));
            await ProductVariant.bulkCreate(tempVariants, { transaction });
        }
        
        if (data.images) {
            await ProductImage.destroy({ where: { productId: id }, transaction });
            const tempImgs = data.images.map(img => ({...img, productId: id}));
            await ProductImage.bulkCreate(tempImgs, { transaction });
        }
        
        if (data.tags) {
            const tagInstances = await Promise.all(data.tags.map(async (tagName) => {
                const tagSlug = await generateSlug(tagName, Tag);
                const [tag] = await Tag.findOrCreate({ where: { name: tagName }, defaults: { slug: tagSlug }, transaction });
                return tag;
            }));
            await product.setTags(tagInstances, { transaction });
        }

        await transaction.commit();

        // Audit log
        try {
            await AuditService.log({
                userId: data.updatedBy || null,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.PRODUCT,
                entityId: id,
                changes: data
            });
        } catch(e) {}

        return exports.getProductBySlug(product.slug || data.slug);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

exports.deleteProduct = async (id, actingUserId = null) => {
    const product = await Product.findByPk(id);
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');

    const snapshot = { name: product.name, sku: product.sku };
    await product.destroy();

    // Audit log
    try {
        await AuditService.log({
            userId: actingUserId,
            action: ACTIONS.DELETE,
            entity: ENTITIES.PRODUCT,
            entityId: id,
            changes: snapshot
        });
    } catch(e) {}

    return true;
};
