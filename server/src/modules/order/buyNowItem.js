'use strict';

const { Product, ProductVariant, Category, Brand, ProductImage } = require('../index');
const AppError = require('../../utils/AppError');

const loadBuyNowItem = async (buyNowItem) => {
    const product = await Product.findByPk(buyNowItem.productId, {
        include: [
            { model: Category, as: 'categories' },
            { model: Brand, as: 'brand' },
            { model: ProductImage, as: 'images' },
        ],
    });

    if (!product) {
        throw new AppError('NOT_FOUND', 404, 'Buy Now product not found');
    }

    let variant = null;
    if (buyNowItem.variantId) {
        variant = await ProductVariant.findOne({
            where: { id: buyNowItem.variantId, productId: buyNowItem.productId, isActive: true },
        });

        if (!variant) {
            throw new AppError('NOT_FOUND', 404, 'Selected product variant not found or is currently unavailable');
        }
    } else {
        const activeVariantCount = await ProductVariant.count({
            where: { productId: buyNowItem.productId, isActive: true },
        });
        if (product.type === 'variable' || activeVariantCount > 0) {
            throw new AppError('VALIDATION_ERROR', 400, `Please select an option for "${product.name}" before checkout.`);
        }
    }

    const quantity = Number(buyNowItem.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new AppError('VALIDATION_ERROR', 400, 'Invalid quantity for Buy Now item');
    }

    return {
        productId: product.id,
        variantId: variant?.id || null,
        quantity,
        product,
        variant,
    };
};

module.exports = { loadBuyNowItem };
