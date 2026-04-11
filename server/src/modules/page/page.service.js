'use strict';

const { Page, Sequelize } = require('../index');
const { Op } = Sequelize;
const { generateSlug } = require('../../utils/slugify');
const { getPagination, getPagingData } = require('../../utils/pagination');
const { sanitizePageContent } = require('../../middleware/sanitize.middleware');
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');
const { ACTIONS, ENTITIES } = require('../../config/constants');

exports.getPages = async (filters, page, limit, isAdmin = false) => {
    const { limit: queryLimit, offset } = getPagination(page, limit);
    const where = {};
    const order = [['sortOrder', 'ASC'], ['createdAt', 'DESC']];

    if (!isAdmin) {
        where.status = 'published';
    } else {
        if (filters.status) where.status = filters.status;
        if (filters.search) {
            where[Op.or] = [
                { title: { [Op.iLike]: `%${filters.search}%` } },
                { content: { [Op.iLike]: `%${filters.search}%` } }
            ];
        }
    }

    if (filters.linkPosition) where.linkPosition = filters.linkPosition;

    const { rows, count } = await Page.findAndCountAll({
        where,
        limit: queryLimit,
        offset,
        order,
        distinct: true,
    });

    return getPagingData(rows, count, page, queryLimit);
};

exports.getPageBySlug = async (slug, { adminView = false } = {}) => {
    const where = { slug };
    if (!adminView) where.status = 'published';
    
    const page = await Page.findOne({ where });
    if (!page) throw new AppError('NOT_FOUND', 404, 'Page not found');
    
    return page;
};

exports.getPageById = async (id) => {
    const page = await Page.findByPk(id);
    if (!page) throw new AppError('NOT_FOUND', 404, 'Page not found');
    return page;
};

exports.createPage = async (data) => {
    const transaction = await Page.sequelize.transaction();
    try {
        const slug = await generateSlug(data.title, Page);
        
        if (data.content) data.content = sanitizePageContent(data.content);

        const page = await Page.create({ ...data, slug }, { transaction });

        await transaction.commit();

        try {
            await AuditService.log({
                userId: data.createdBy || null,
                action: ACTIONS.CREATE,
                entity: ENTITIES.PAGE || 'PAGE',
                entityId: page.id,
                changes: { title: page.title, slug: page.slug },
            });
        } catch (e) {}

        return page;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

exports.updatePage = async (id, data) => {
    const page = await Page.findByPk(id);
    if (!page) throw new AppError('NOT_FOUND', 404, 'Page not found');

    const transaction = await Page.sequelize.transaction();
    try {
        if (data.title && data.title !== page.title) {
            data.slug = await generateSlug(data.title, Page);
        }

        if (data.content) data.content = sanitizePageContent(data.content);

        await page.update(data, { transaction });

        await transaction.commit();

        try {
            await AuditService.log({
                userId: data.updatedBy || null,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.PAGE || 'PAGE',
                entityId: id,
                changes: data,
            });
        } catch (e) {}

        return page;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

exports.deletePage = async (id, actingUserId = null) => {
    const page = await Page.findByPk(id);
    if (!page) throw new AppError('NOT_FOUND', 404, 'Page not found');
    
    if (page.isSystem) {
        throw new AppError('FORBIDDEN', 403, 'System pages cannot be deleted');
    }

    const snapshot = { title: page.title, slug: page.slug };
    await page.destroy();

    try {
        await AuditService.log({
            userId: actingUserId,
            action: ACTIONS.DELETE,
            entity: ENTITIES.PAGE || 'PAGE',
            entityId: id,
            changes: snapshot,
        });
    } catch (e) {}

    return true;
};
