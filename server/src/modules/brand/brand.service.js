'use strict';

const { Brand, Product } = require('../index');
const { Op } = require('sequelize');
const { generateSlug } = require('../../utils/slugify');
const AppError = require('../../utils/AppError');

const createBrand = async (data) => {
    const { name, slug, description, image, isActive } = data;
    
    // Use text from slug if provided, otherwise name, and ensure uniqueness
    const finalSlug = await generateSlug(slug || name, Brand);

    return await Brand.create({
        name,
        slug: finalSlug,
        description,
        image,
        isActive: isActive !== undefined ? isActive : true,
    });
};

const getBrands = async (query = {}) => {
    const { search, isActive, limit = 20, page = 1, sortBy = 'name', sortOrder = 'ASC' } = query;
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
        where.name = { [Op.iLike]: `%${search}%` };
    }
    if (isActive !== undefined) {
        where.isActive = isActive === 'true' || isActive === true;
    }

    const { count, rows } = await Brand.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [[sortBy, sortOrder]],
    });

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

const getBrandBySlug = async (slug) => {
    const brand = await Brand.findOne({
        where: { slug },
        include: [{ model: Product, as: 'products', where: { status: 'published', isEnabled: true }, required: false, limit: 10 }]
    });

    if (!brand) {
        throw new AppError('BRAND_ERROR', 404, 'Brand not found');
    }

    return brand;
};

const updateBrand = async (id, data) => {
    const brand = await Brand.findByPk(id);
    if (!brand) {
        throw new AppError('BRAND_ERROR', 404, 'Brand not found');
    }

    const { name, slug, description, image, isActive } = data;
    
    let finalSlug = brand.slug;
    if (slug && slug !== brand.slug) {
        // If brand explicitly provides a new slug, ensure it's unique
        finalSlug = await generateSlug(slug, Brand);
    } else if (name && name !== brand.name && !slug) {
        // If name changes but no slug provided, generate new unique slug from name
        finalSlug = await generateSlug(name, Brand);
    }

    await brand.update({
        name: name || brand.name,
        slug: finalSlug,
        description: description !== undefined ? description : brand.description,
        image: image !== undefined ? image : brand.image,
        isActive: isActive !== undefined ? isActive : brand.isActive,
    });

    return brand;
};

const deleteBrand = async (id) => {
    const brand = await Brand.findByPk(id);
    if (!brand) {
        throw new AppError('BRAND_ERROR', 404, 'Brand not found');
    }

    // According to user preference: "set brand_id to null" on products
    // Sequelize association with onDelete: 'SET NULL' handles this if we use queryInterface or raw deletes, 
    // but for application level soft delete/logic we should be careful.
    // Since we are doing a hard delete of the brand entry here:
    await brand.destroy();
    return true;
};

module.exports = {
    createBrand,
    getBrands,
    getBrandBySlug,
    updateBrand,
    deleteBrand,
};
