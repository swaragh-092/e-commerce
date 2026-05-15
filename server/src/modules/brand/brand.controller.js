'use strict';

const brandService = require('./brand.service');
const { success, paginated } = require('../../utils/response');
const { serializeProductPricing } = require('../product/product.pricing');
const { getSaleLabels } = require('../settings/saleLabel.service');
const SettingsService = require('../settings/settings.service');

const { PERMISSIONS, getPermissionsForUser } = require('../../config/permissions');

const hasBrandAdminView = (user) => getPermissionsForUser(user).includes(PERMISSIONS.PRODUCTS_READ);

const createBrand = async (req, res, next) => {
    try {
        const brand = await brandService.createBrand(req.validated);
        return success(res, { brand }, 'Brand created successfully', 201);
    } catch (err) {
        next(err);
    }
};

const getBrands = async (req, res, next) => {
    try {
        const isAdmin = hasBrandAdminView(req.user);
        const { brands, meta } = await brandService.getBrands(req.query, isAdmin);
        return paginated(res, brands, meta.total, meta.page, meta.limit, 'Brands retrieved successfully');
    } catch (err) {
        next(err);
    }
};

const getBrandBySlug = async (req, res, next) => {
    try {
        const isAdmin = hasBrandAdminView(req.user);
        const brand = await brandService.getBrandBySlug(req.params.slug, isAdmin, req.query);
        
        // If storefront view and brand has products, serialize them
        if (!isAdmin && brand.products) {
            const [labelPresets, { features }] = await Promise.all([
                getSaleLabels().catch(() => []),
                SettingsService.getFeatures(),
            ]);
            
            brand.products = brand.products.map(product => 
                serializeProductPricing(product, { adminView: false, features }, labelPresets)
            );
        }
        
        return success(res, { brand }, 'Brand retrieved successfully');
    } catch (err) {
        next(err);
    }
};

const updateBrand = async (req, res, next) => {
    try {
        const brand = await brandService.updateBrand(req.params.id, req.validated);
        return success(res, { brand }, 'Brand updated successfully');
    } catch (err) {
        next(err);
    }
};

const deleteBrand = async (req, res, next) => {
    try {
        await brandService.deleteBrand(req.params.id);
        return success(res, null, 'Brand deleted successfully');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createBrand,
    getBrands,
    getBrandBySlug,
    updateBrand,
    deleteBrand,
};
