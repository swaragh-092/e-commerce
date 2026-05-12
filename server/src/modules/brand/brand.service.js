'use strict';

const { Brand, Product } = require('../index');
const { Op } = require('sequelize');
const { generateSlug } = require('../../utils/slugify');
const AppError = require('../../utils/AppError');

const createBrand = async (data) => {
    const transaction = await Brand.sequelize.transaction();
    try {
        const { name, slug, description, image, isActive = true, isPromoted = false } = data;
        
        // Use text from slug if provided, otherwise name, and ensure uniqueness
        const finalSlug = await generateSlug(slug || name, Brand, 'slug', { transaction });

        const brand = await Brand.create({
            name,
            slug: finalSlug,
            description,
            image,
            isActive,
            isPromoted,
        }, { transaction });
        
        await transaction.commit();
        return brand;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

const getBrands = async (query = {}, isAdmin = false) => {
    const {
        search,
        isActive,
        isPromoted,
        withPublishedProducts,
        limit = 20,
        page = 1,
        sortBy = 'name',
        sortOrder = 'ASC',
    } = query;
    const offset = (page - 1) * limit;

    const where = {};
    const include = [];

    // For storefront, always only show active brands
    if (!isAdmin) {
        where.isActive = true;
    } else if (isActive !== undefined) {
        // For admin, allow filtering by isActive status if provided
        where.isActive = isActive === 'true' || isActive === true;
    }

    if (search) {
        where.name = { [Op.iLike]: `%${search}%` };
    }

    if (isPromoted !== undefined) {
        where.isPromoted = isPromoted === 'true' || isPromoted === true;
    }

    if (withPublishedProducts === 'true' || withPublishedProducts === true) {
        include.push({
            model: Product,
            as: 'products',
            attributes: [],
            required: true,
            where: {
                status: 'published',
                isEnabled: true,
            },
        });
    }

    // Map frontend sort names to database columns/attributes
    const sortMap = {
        name: 'name',
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        created_at: 'createdAt', // fallback
        updated_at: 'updatedAt', // fallback
    };

    const orderCol = sortMap[sortBy] || 'name';
    const orderDir = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const queryOptions = {
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [[orderCol, orderDir]],
    };

    if (include.length > 0) {
        queryOptions.include = include;
        queryOptions.distinct = true;
    }

    const { count, rows } = await Brand.findAndCountAll(queryOptions);

    return {
        brands: rows,
        meta: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit),
        },
    };
};

const getBrandBySlug = async (slug, isAdmin = false, query = {}) => {
    const { productLimit } = query;
    const where = { slug };
    if (!isAdmin) {
        where.isActive = true;
    }

    const productInclude = {
        model: Product,
        as: 'products',
        required: false,
    };

    // If not admin, only show active/published products
    if (!isAdmin) {
        productInclude.where = { status: 'published', isEnabled: true };
        productInclude.limit = parseInt(productLimit) || 10;
    } else {
        // For admin, allow configurable limit but default to no limit if not specified
        if (productLimit) {
            productInclude.limit = parseInt(productLimit);
        }
    }

    const brand = await Brand.findOne({
        where,
        include: [productInclude]
    });

    if (!brand) {
        throw new AppError('BRAND_ERROR', 404, 'Brand not found');
    }

    return brand;
};

const updateBrand = async (id, data) => {
    const transaction = await Brand.sequelize.transaction();
    try {
        const brand = await Brand.findByPk(id, { transaction });
        if (!brand) {
            throw new AppError('BRAND_ERROR', 404, 'Brand not found');
        }

        const { name, slug, description, image, isActive, isPromoted } = data;
        
        let finalSlug = brand.slug;
        if (slug && slug !== brand.slug) {
            // If brand explicitly provides a new slug, ensure it's unique
            finalSlug = await generateSlug(slug, Brand, 'slug', { transaction });
        } else if (name && name !== brand.name && !slug) {
            // If name changes but no slug provided, generate new unique slug from name
            finalSlug = await generateSlug(name, Brand, 'slug', { transaction });
        }

        await brand.update({
            name: name || brand.name,
            slug: finalSlug,
            description: description !== undefined ? description : brand.description,
            image: image !== undefined ? image : brand.image,
            isActive: isActive !== undefined ? isActive : brand.isActive,
            isPromoted: isPromoted !== undefined ? isPromoted : brand.isPromoted,
        }, { transaction });

        await transaction.commit();
        return brand;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

const deleteBrand = async (id) => {
    const transaction = await sequelize.transaction();
    try {
        const brand = await Brand.findByPk(id, { transaction });
        if (!brand) {
            throw new AppError('BRAND_ERROR', 404, 'Brand not found');
        }

        await brand.destroy({ transaction });
        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

module.exports = {
    createBrand,
    getBrands,
    getBrandBySlug,
    updateBrand,
    deleteBrand,
};
