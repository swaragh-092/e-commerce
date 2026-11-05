'use strict';

const { sequelize, VariantOption, ProductVariant } = require('../index');
const AppError = require('../../utils/AppError');

// Share the creation/generation lock so dependency checks and attribute changes
// cannot race with a new variant, including when no variants exist yet.
const lockProductVariantChanges = (productId, transaction) => sequelize.query(
    'SELECT pg_advisory_xact_lock(hashtext(:scope), hashtext(:productId))',
    { replacements: { scope: 'product-variant-generation', productId }, transaction },
);

const assertAttributeNotUsedByVariants = async (productId, attributeId, transaction) => {
    if (!attributeId) return;
    const dependency = await VariantOption.findOne({
        where: { attributeId },
        include: [{ model: ProductVariant, as: 'variant', attributes: [], required: true, where: { productId } }],
        transaction,
    });
    // ProductVariant's paranoid scope excludes deleted variants. Unavailable
    // variants still exist and must continue to protect their options.
    if (dependency) throw new AppError('CONFLICT', 409,
        'This attribute is used by existing variants. Delete those variants before turning off “Use for variants” or removing/changing the attribute.');
};

const assertAttributeRemovalAllowed = async (productId, rows, transaction) => {
    if (rows.some((row) => row.attributeId && row.isVariantAttr)) {
        throw new AppError('CONFLICT', 409, 'Turn off “Use for variants” before removing this attribute or its values. Delete any variants using it first.');
    }
    await assertAttributeNotUsedByVariants(productId, rows[0]?.attributeId, transaction);
};

module.exports = { lockProductVariantChanges, assertAttributeNotUsedByVariants, assertAttributeRemovalAllowed };
