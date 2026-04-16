'use strict';

const {
  Product,
  ProductImage,
  ProductVariant,
  ProductAttribute,
  VariantOption,
  AttributeTemplate,
  AttributeValue,
  Tag,
  Category,
  Brand,
  OrderItem,
  Sequelize,
} = require('../index');
const { Op } = Sequelize;
const { generateSlug } = require('../../utils/slugify');
// Note: Although the ARCHITECTURE/STANDARDS refer to generateUniqueSlug(),
// the slugify.js utility internally implements the collision-safe loop
// and exports it as generateSlug. This handles duplicates automatically.
const { getPagination, getPagingData } = require('../../utils/pagination');
const sanitizeHtml = require('sanitize-html');
const AuditService = require('../audit/audit.service');
const AppError = require('../../utils/AppError');
const { ACTIONS, ENTITIES } = require('../../config/constants');
const { getCategoryAndDescendantIds } = require('../category/category.service');
const { normalizeSalePayload, serializeProductPricing } = require('./product.pricing');

const sanitizeRichText = (html) => {
  if (!html) return html;
  return sanitizeHtml(html, {
    allowedTags: [
      'b',
      'i',
      'em',
      'strong',
      'a',
      'p',
      'br',
      'ul',
      'ol',
      'li',
      'h2',
      'h3',
      'h4',
      'img',
    ],
    allowedAttributes: { a: ['href'], img: ['src', 'alt'] },
  });
};

const variantInclude = {
  model: ProductVariant,
  as: 'variants',
  include: [
    {
      model: VariantOption,
      as: 'options',
      include: [
        { model: AttributeTemplate, as: 'attribute', attributes: ['id', 'name', 'slug'] },
        { model: AttributeValue, as: 'value', attributes: ['id', 'value', 'slug'] },
      ],
    },
  ],
};

const attributeInclude = {
  model: ProductAttribute,
  as: 'attributes',
  include: [
    { model: AttributeTemplate, as: 'attribute', attributes: ['id', 'name', 'slug'] },
    { model: AttributeValue, as: 'value', attributes: ['id', 'value', 'slug'] },
  ],
};

const validateVariantOptions = async (variants) => {
  if (!variants?.length) return;

  for (const variant of variants) {
    for (const option of variant.options) {
      const match = await AttributeValue.findOne({
        where: {
          id: option.valueId,
          attributeId: option.attributeId,
        },
        attributes: ['id'],
      });

      if (!match) {
        throw new AppError(
          'VALIDATION_ERROR',
          400,
          'One or more variant options reference an invalid attribute/value pair'
        );
      }
    }
  }
};

const createVariantsWithOptions = async (productId, variants, transaction) => {
  if (!variants?.length) return;

  await validateVariantOptions(variants);

  for (const variant of variants) {
    const createdVariant = await ProductVariant.create(
      {
        productId,
        sku: variant.sku ?? null,
        price: variant.price,
        stockQty: variant.stockQty ?? 0,
        isActive: variant.isActive ?? true,
        sortOrder: variant.sortOrder ?? 0,
      },
      { transaction }
    );

    const optionRows = variant.options.map((option) => ({
      variantId: createdVariant.id,
      attributeId: option.attributeId,
      valueId: option.valueId,
    }));

    await VariantOption.bulkCreate(optionRows, { transaction });
  }
};

const replaceVariantsWithOptions = async (productId, variants, transaction) => {
  const existingVariants = await ProductVariant.findAll({
    where: { productId },
    attributes: ['id'],
    paranoid: false,
    transaction,
  });

  const variantIds = existingVariants.map((variant) => variant.id);
  if (variantIds.length) {
    await VariantOption.destroy({ where: { variantId: variantIds }, transaction });
    await ProductVariant.destroy({ where: { id: variantIds }, force: true, transaction });
  }

  await createVariantsWithOptions(productId, variants, transaction);
};

exports.getProducts = async (filters, page, limit, isAdmin = false) => {
  const { limit: queryLimit, offset } = getPagination(page, limit);
  const where = {};
  const order = [];
  const now = new Date();

  // Always restrict to published products for storefront; admins can filter by any status
  if (!isAdmin) {
    where.status = 'published';
  } else if (filters.status) {
    where.status = filters.status;
  }

  // Filter Logic
  if (filters.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: '%' + filters.search + '%' } },
      { description: { [Op.iLike]: '%' + filters.search + '%' } },
    ];
  }
  if (filters.minPrice || filters.maxPrice) {
    where.price = {};
    if (filters.minPrice) where.price[Op.gte] = filters.minPrice;
    if (filters.maxPrice) where.price[Op.lte] = filters.maxPrice;
  }
  if (filters.brand) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.brand);
    if (isUUID) {
      where.brandId = filters.brand;
    } else {
      const b = await Brand.findOne({ where: { slug: filters.brand }, attributes: ['id'] });
      if (b) {
        where.brandId = b.id;
      } else {
        where.id = null;
      }
    }
  }
  if (isAdmin && filters.saleStatus) {
    const saleFilters = {
      none: { salePrice: null },
      scheduled: {
        salePrice: { [Op.ne]: null },
        saleStartAt: { [Op.gt]: now },
      },
      active: {
        [Op.and]: [
          { salePrice: { [Op.ne]: null } },
          { [Op.or]: [{ saleStartAt: null }, { saleStartAt: { [Op.lte]: now } }] },
          { [Op.or]: [{ saleEndAt: null }, { saleEndAt: { [Op.gte]: now } }] },
        ],
      },
      expired: {
        [Op.and]: [
          { salePrice: { [Op.ne]: null } },
          { saleEndAt: { [Op.lt]: now } },
        ],
      },
    };

    if (saleFilters[filters.saleStatus]) {
      where[Op.and] = [...(where[Op.and] || []), saleFilters[filters.saleStatus]];
    }
  }

  if (filters.featured === 'true' || filters.featured === true) {
    where.isFeatured = true;
  }

  // sale: salePrice is set AND sale window is active (or no window defined)
  if (filters.onSale === 'true' || filters.onSale === true || filters.sale === 'true' || filters.sale === true) {
    where[Op.and] = [
      ...(where[Op.and] || []),
      { salePrice: { [Op.ne]: null } },
      { [Op.or]: [{ saleStartAt: null }, { saleStartAt: { [Op.lte]: now } }] },
      { [Op.or]: [{ saleEndAt: null }, { saleEndAt: { [Op.gte]: now } }] },
    ];
  }

  const SORTABLE_FIELDS = { price: 'price', quantity: 'quantity', name: 'name', createdAt: 'createdAt' };
  if (filters.sort === 'best-selling') {
    // Subquery: rank products by total units sold across all orders
    order.push([
      Sequelize.literal(`(
        SELECT COALESCE(SUM(oi.quantity), 0)
        FROM order_items oi
        WHERE oi.product_id = "Product"."id"
      )`),
      'DESC',
    ]);
  } else if (filters.sortBy && SORTABLE_FIELDS[filters.sortBy]) {
    const dir = filters.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    order.push([SORTABLE_FIELDS[filters.sortBy], dir]);
  } else if (filters.sort === 'price_asc') order.push(['price', 'ASC']);
  else if (filters.sort === 'price_desc') order.push(['price', 'DESC']);
  else if (filters.sort === 'newest') order.push(['createdAt', 'DESC']);
  else if (filters.sort === 'name_asc') order.push(['name', 'ASC']);
  else order.push(['createdAt', 'DESC']);

  const include = [
    { model: ProductImage, as: 'images' },
    { model: ProductVariant, as: 'variants' },
    { model: Tag, as: 'tags' },
    { model: Brand, as: 'brand' },
  ];

  if (filters.categoryId) {
    const categoryIds = await getCategoryAndDescendantIds(filters.categoryId);
    include.push({
      model: Category,
      as: 'categories',
      where: { id: { [Op.in]: categoryIds } },
      required: true,
    });
  } else if (filters.category) {
    const rootCat = await Category.findOne({
      where: { slug: filters.category },
      attributes: ['id'],
    });
    if (rootCat) {
      const categoryIds = await getCategoryAndDescendantIds(rootCat.id);
      include.push({
        model: Category,
        as: 'categories',
        where: { id: { [Op.in]: categoryIds } },
        required: true,
      });
    } else {
      where.id = null;
      include.push({ model: Category, as: 'categories' });
    }
  } else {
    include.push({ model: Category, as: 'categories' });
  }

  const { rows, count } = await Product.findAndCountAll({
    where,
    limit: queryLimit,
    offset,
    order,
    include,
    distinct: true,
  });

  return getPagingData(rows.map((row) => serializeProductPricing(row, { adminView: isAdmin })), count, page, queryLimit);
};

exports.getProductBySlug = async (slug, { adminView = false } = {}) => {
  const where = { slug };
  if (!adminView) where.status = 'published';
  const product = await Product.findOne({
    where,
    include: [
      { model: ProductImage, as: 'images' },
      variantInclude,
      attributeInclude,
      { model: Category, as: 'categories' },
      { model: Tag, as: 'tags' },
      { model: Brand, as: 'brand' },
    ],
  });
  if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
  return serializeProductPricing(product, { adminView });
};

exports.getProductById = async (id) => {
  const product = await Product.findByPk(id, {
    include: [
      { model: ProductImage, as: 'images' },
      variantInclude,
      attributeInclude,
      { model: Category, as: 'categories' },
      { model: Tag, as: 'tags' },
      { model: Brand, as: 'brand' },
    ],
  });
  if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
  return serializeProductPricing(product, { adminView: true });
};

exports.createProduct = async (data) => {
  const transaction = await Product.sequelize.transaction();
  try {
    data = normalizeSalePayload(data);
    const slug = await generateSlug(data.name, Product);

    if (data.description) data.description = sanitizeRichText(data.description);

    const product = await Product.create({ ...data, slug }, { transaction });

    if (data.categoryIds && data.categoryIds.length) {
      await product.setCategories(data.categoryIds, { transaction });
    }

    if (data.variants && data.variants.length) {
      await createVariantsWithOptions(product.id, data.variants, transaction);
    }

    if (data.images && data.images.length) {
      const tempImgs = data.images.map((img) => ({ ...img, productId: product.id }));
      await ProductImage.bulkCreate(tempImgs, { transaction });
    }

    if (data.tags && data.tags.length) {
      const tagInstances = await Promise.all(
        data.tags.map(async (tagName) => {
          const tagSlug = await generateSlug(tagName, Tag);
          const [tag] = await Tag.findOrCreate({
            where: { name: tagName },
            defaults: { slug: tagSlug },
            transaction,
          });
          return tag;
        })
      );
      await product.setTags(tagInstances, { transaction });
    }

    await transaction.commit();

    try {
      await AuditService.log({
        userId: data.createdBy || null,
        action: ACTIONS.CREATE,
        entity: ENTITIES.PRODUCT,
        entityId: product.id,
        changes: { name: product.name, sku: product.sku },
      });
    } catch (e) {}

    return exports.getProductBySlug(slug, { adminView: true });
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
    data = normalizeSalePayload(data, product.price);
    if (data.name && data.name !== product.name) {
      data.slug = await generateSlug(data.name, Product);
    }

    if (data.description) data.description = sanitizeRichText(data.description);

    await product.update(data, { transaction });

    if (data.categoryIds) {
      await product.setCategories(data.categoryIds, { transaction });
    }

    if (data.variants) {
      await replaceVariantsWithOptions(id, data.variants, transaction);
    }

    if (data.images) {
      await ProductImage.destroy({ where: { productId: id }, transaction });
      const tempImgs = data.images.map((img) => ({ ...img, productId: id }));
      await ProductImage.bulkCreate(tempImgs, { transaction });
    }

    if (data.tags) {
      const tagInstances = await Promise.all(
        data.tags.map(async (tagName) => {
          const tagSlug = await generateSlug(tagName, Tag);
          const [tag] = await Tag.findOrCreate({
            where: { name: tagName },
            defaults: { slug: tagSlug },
            transaction,
          });
          return tag;
        })
      );
      await product.setTags(tagInstances, { transaction });
    }

    await transaction.commit();

    try {
      await AuditService.log({
        userId: data.updatedBy || null,
        action: ACTIONS.UPDATE,
        entity: ENTITIES.PRODUCT,
        entityId: id,
        changes: data,
      });
    } catch (e) {}

    return exports.getProductBySlug(data.slug || product.slug, { adminView: true });
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

  try {
    await AuditService.log({
      userId: actingUserId,
      action: ACTIONS.DELETE,
      entity: ENTITIES.PRODUCT,
      entityId: id,
      changes: snapshot,
    });
  } catch (e) {}

  return true;
};

exports.bulkUpdateSale = async (payload, actingUserId = null) => {
  const { action, productIds, saleType, value, saleStartAt, saleEndAt, saleLabel } = payload;

  if (action === 'apply' && saleType === 'percentage' && Number(value) >= 100) {
    throw new AppError('VALIDATION_ERROR', 400, 'Percentage discount must be less than 100');
  }

  return Product.sequelize.transaction(async (transaction) => {
    const products = await Product.findAll({
      where: { id: productIds },
      transaction,
    });

    if (products.length !== productIds.length) {
      throw new AppError('NOT_FOUND', 404, 'One or more products were not found');
    }

    for (const product of products) {
      const updatePayload = action === 'clear'
        ? normalizeSalePayload({ salePrice: null, saleStartAt: null, saleEndAt: null, saleLabel: null }, product.price)
        : normalizeSalePayload({
            salePrice: saleType === 'fixed'
              ? Number(value)
              : Number((Number(product.price) * (1 - (Number(value) / 100))).toFixed(2)),
            saleStartAt: saleStartAt || null,
            saleEndAt: saleEndAt || null,
            saleLabel: saleLabel || null,
          }, product.price);

      await product.update(updatePayload, { transaction });

      try {
        await AuditService.log({
          userId: actingUserId,
          action: ACTIONS.UPDATE,
          entity: ENTITIES.PRODUCT,
          entityId: product.id,
          changes: action === 'clear'
            ? { salePrice: null, saleStartAt: null, saleEndAt: null, saleLabel: null }
            : { saleType, value, saleStartAt: saleStartAt || null, saleEndAt: saleEndAt || null, saleLabel: saleLabel || null },
        });
      } catch (e) {}
    }

    return {
      action,
      updatedCount: products.length,
      productIds: products.map((product) => product.id),
    };
  });
};
