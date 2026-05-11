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
  Media,
  ProductTab,
  Sequelize,
} = require('../index');
const { Op } = Sequelize;
const salePriceIsDiscounted = Sequelize.where(Sequelize.col('sale_price'), Op.lt, Sequelize.col('price'));
const { generateSlug } = require('../../utils/slugify');
// Note: Although the ARCHITECTURE/STANDARDS refer to generateUniqueSlug(),
// the slugify.js utility internally implements the collision-safe loop
// and exports it as generateSlug. This handles duplicates automatically.
const { getPagination, getPagingData } = require('../../utils/pagination');
const sanitizeHtml = require('sanitize-html');
const AuditService = require('../audit/audit.service');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { ACTIONS, ENTITIES } = require('../../config/constants');
const { getCategoryAndDescendantIds } = require('../category/category.service');
const { normalizeSalePayload, serializeProductPricing } = require('./product.pricing');
const { events, PRODUCT_EVENTS } = require('../../utils/events');
const { getSaleLabels } = require('../settings/saleLabel.service');
const SettingsService = require('../settings/settings.service');


// Fetch the active label catalog once per request (the service caches for 60 s)
const getLabelPresets = () => getSaleLabels().catch(() => []);

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
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['http', 'https'],
    },
  });
};

const _syncProductTags = async (product, tagNames, transaction) => {
  if (!tagNames || !Array.isArray(tagNames)) return;

  const tagInstances = await Promise.all(
    tagNames.map(async (tagName) => {
      const tagSlug = await generateSlug(tagName, Tag, 'slug', { transaction });
      const [tag] = await Tag.findOrCreate({
        where: { name: tagName },
        defaults: { slug: tagSlug },
        transaction,
      });
      return tag;
    })
  );
  await product.setTags(tagInstances, { transaction });
};

const getCommonAttributeIncludes = () => [
  { model: AttributeTemplate, as: 'attribute', attributes: ['id', 'name', 'slug'] },
  { model: AttributeValue, as: 'value', attributes: ['id', 'value', 'slug'] },
];

const getVariantInclude = () => ({
  model: ProductVariant,
  as: 'variants',
  include: [
    {
      model: VariantOption,
      as: 'options',
      include: getCommonAttributeIncludes(),
    },
    {
      model: Media,
      as: 'media',
    },
  ],
});

const getAttributeInclude = () => ({
  model: ProductAttribute,
  as: 'attributes',
  include: getCommonAttributeIncludes(),
});

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

const validateProductImages = async (images) => {
  if (!images?.length) return;

  const mediaIds = images.map(img => img.mediaId).filter(Boolean);
  if (mediaIds.length === 0) return;

  const count = await Media.count({
    where: { id: { [Op.in]: mediaIds } }
  });

  if (count !== mediaIds.length) {
    throw new AppError('VALIDATION_ERROR', 400, 'One or more images reference an invalid media ID');
  }
};

const validateProductStock = (data, currentProduct = null) => {
  const qty = data.quantity !== undefined ? data.quantity : (currentProduct ? currentProduct.quantity : 0);
  const reserved = data.reservedQty !== undefined ? data.reservedQty : (currentProduct ? currentProduct.reservedQty : 0);

  if (reserved < 0) {
    throw new AppError('VALIDATION_ERROR', 400, 'Reserved quantity cannot be negative');
  }

  if (reserved > qty) {
    throw new AppError('VALIDATION_ERROR', 400, 'Reserved quantity cannot exceed total quantity');
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
  const include = [
    { model: ProductImage, as: 'images' },
    { model: Tag, as: 'tags' },
    { model: Brand, as: 'brand' },
  ];
  const now = new Date();

  // Always restrict to published + enabled products for storefront; admins can filter by any status
  if (!isAdmin) {
    where.status = 'published';
    where.isEnabled = true;
  } else {
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.isEnabled !== undefined) {
      where.isEnabled = filters.isEnabled === 'true' || filters.isEnabled === true;
    }
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
  if (filters.maxQty !== undefined && filters.maxQty !== null) {
    where.quantity = { [Op.lte]: parseInt(filters.maxQty) };
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
  if (filters.saleStatus) {
    const saleFilters = {
      none: { salePrice: null },
      scheduled: {
        salePrice: { [Op.ne]: null },
        saleStartAt: { [Op.gt]: now },
      },
      active: {
        [Op.and]: [
          { salePrice: { [Op.ne]: null } },
          Sequelize.where(Sequelize.col('sale_price'), Op.lt, Sequelize.col('price')),
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
      const filter = saleFilters[filters.saleStatus];
      if (filter[Op.and]) {
        where[Op.and] = [...(where[Op.and] || []), ...filter[Op.and]];
      } else {
        where[Op.and] = [...(where[Op.and] || []), filter];
      }
    }
  }

  if (filters.featured === 'true' || filters.featured === true) {
    where.isFeatured = true;
  }
  
  if (filters.tags) {
    const tagList = Array.isArray(filters.tags) ? filters.tags : filters.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (tagList.length > 0) {
      const tagInclude = include.find(inc => inc.as === 'tags');
      if (tagInclude) {
        tagInclude.where = { name: { [Op.in]: tagList } };
        tagInclude.required = true;
      }
    }
  } else {
    include.push({ model: Tag, as: 'tags' });
  }

  // sale: salePrice is set AND sale window is active (or no window defined)
  if (filters.onSale === 'true' || filters.onSale === true || filters.sale === 'true' || filters.sale === true) {
    where[Op.and] = [
      ...(where[Op.and] || []),
      { salePrice: { [Op.ne]: null } },
      salePriceIsDiscounted,
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


  const requestedIncludes = filters.include && typeof filters.include === 'string' ? filters.include.split(',').map(s => s.trim()).filter(Boolean) : [];

  if (requestedIncludes.includes('variants')) {
    include.push(getVariantInclude());
  } else {
    include.push({ model: ProductVariant, as: 'variants' });
  }

  if (requestedIncludes.includes('attributes')) {
    include.push(getAttributeInclude());
  }

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

  let counts = {};
  if (isAdmin) {
    const countWhere = { ...where };
    delete countWhere.status;

    // For status counts, we need to preserve any required includes (joins used for filtering)
    // like categories or tags, but strip out attributes to keep it light.
    const countInclude = include
      .filter(inc => inc.required)
      .map(inc => ({ 
        ...inc, 
        attributes: [],
        through: { attributes: [] } // Ensure junction table columns aren't selected
      }));

    const statusCounts = await Product.findAll({
      where: countWhere,
      include: countInclude,
      attributes: [
        'status',
        [Sequelize.fn('COUNT', Sequelize.literal('DISTINCT "Product"."id"')), 'count']
      ],
      group: ['Product.status'],
      subQuery: false, // Prevent complex subqueries that break GROUP BY
      raw: true
    });
    
    counts = statusCounts.reduce((acc, curr) => {
      // Sequelize raw result with group often has count as a string
      acc[curr.status] = parseInt(curr.count || 0, 10);
      return acc;
    }, {});
  }

  const labelPresets = await getLabelPresets();
  const { features } = await SettingsService.getFeatures();
  const serializedRows = rows.map((row) => serializeProductPricing(row, { adminView: isAdmin, features }, labelPresets));
  
  const pagingData = getPagingData(serializedRows, count, page, queryLimit);
  if (isAdmin) {
    pagingData.counts = counts;
  }
  return pagingData;
};

exports.getProductBySlug = async (slug, { adminView = false } = {}) => {
  const where = { slug };
  if (!adminView) {
    where.status = 'published';
    where.isEnabled = true;
  }
  const product = await Product.findOne({
    where,
    include: [
      { model: ProductImage, as: 'images' },
      getVariantInclude(),
      getAttributeInclude(),
      { model: Category, as: 'categories' },
      { model: Tag, as: 'tags' },
      { model: Brand, as: 'brand' },
      // Only active tabs, sorted for storefront display
      {
        model: ProductTab,
        as: 'tabs',
        where: { isActive: true },
        required: false,
      },
    ],
    order: [
      ['tabs', 'sort_order', 'ASC'],
    ],
  });
  if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
  const labelPresets = await getLabelPresets();
  const { features } = await SettingsService.getFeatures();
  return serializeProductPricing(product, { adminView, features }, labelPresets);
};

exports.getProductById = async (id) => {
  const product = await Product.findByPk(id, {
    include: [
      { model: ProductImage, as: 'images' },
      getVariantInclude(),
      getAttributeInclude(),
      { model: Category, as: 'categories' },
      { model: Tag, as: 'tags' },
      { model: Brand, as: 'brand' },
      // All tabs (including inactive) for admin view
      {
        model: ProductTab,
        as: 'tabs',
        required: false,
      },
    ],
    order: [
      ['tabs', 'sort_order', 'ASC'],
    ],
  });
  if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
  const labelPresets = await getLabelPresets();
  const { features } = await SettingsService.getFeatures();
  return serializeProductPricing(product, { adminView: true, features }, labelPresets);
};

exports.createProduct = async (data, auditContext = null) => {
  const transaction = await Product.sequelize.transaction();
  const labelPresets = await getLabelPresets();
  try {
    data = normalizeSalePayload(data, null, { labelPresets });
    const slug = data.slug ? await generateSlug(data.slug, Product, 'slug', { transaction }) : await generateSlug(data.name, Product, 'slug', { transaction });

    if (data.description) data.description = sanitizeRichText(data.description);

    if (data.brandId) {
      const brand = await Brand.findByPk(data.brandId);
      if (!brand) throw new AppError('NOT_FOUND', 404, 'Brand not found');
    }

    validateProductStock(data);
    if (data.images) await validateProductImages(data.images);

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

    if (data.tags) {
      await _syncProductTags(product, data.tags, transaction);
    }

    await transaction.commit();

      try {
        await AuditService.log({
          userId: auditContext?.userId || null,
          action: ACTIONS.CREATE,
          entity: ENTITIES.PRODUCT,
          entityId: product.id,
          changes: { name: product.name, sku: product.sku },
          ipAddress: auditContext?.ip,
          userAgent: auditContext?.userAgent,
        });
        
        events.emit(PRODUCT_EVENTS.CREATED, {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          actingUserId: auditContext?.userId
        });
      } catch (e) {
        logger.error('Failed to log audit or emit event for product creation:', e);
      }

    return exports.getProductBySlug(slug, { adminView: true });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

exports.updateProduct = async (id, data, auditContext = null) => {
  const product = await Product.findByPk(id);
  if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');

  const transaction = await Product.sequelize.transaction();
  const labelPresets = await getLabelPresets();
  try {
    data = normalizeSalePayload(data, product.price, { labelPresets });
    
    if (data.slug && data.slug !== product.slug) {
      data.slug = await generateSlug(data.slug, Product, 'slug', { transaction });
    } else if (data.name && data.name !== product.name && !data.slug) {
      data.slug = await generateSlug(data.name, Product, 'slug', { transaction });
    } else {
      delete data.slug;
    }

    if (data.description) data.description = sanitizeRichText(data.description);

    if (data.brandId && data.brandId !== product.brandId) {
      const brand = await Brand.findByPk(data.brandId);
      if (!brand) throw new AppError('NOT_FOUND', 404, 'Brand not found');
    }

    validateProductStock(data, product);
    if (data.images) await validateProductImages(data.images);

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
      await _syncProductTags(product, data.tags, transaction);
    }

    await transaction.commit();

    try {
      await AuditService.log({
        userId: auditContext?.userId || null,
        action: ACTIONS.UPDATE,
        entity: ENTITIES.PRODUCT,
        entityId: id,
        changes: data,
        ipAddress: auditContext?.ip,
        userAgent: auditContext?.userAgent,
      });
      
      events.emit(PRODUCT_EVENTS.UPDATED, {
        productId: id,
        changes: data,
        actingUserId: auditContext?.userId
      });
    } catch (e) {
      logger.error('Failed to log audit or emit event for product update:', e);
    }

    return exports.getProductBySlug(data.slug || product.slug, { adminView: true });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

exports.deleteProduct = async (id, auditContext = null) => {
  const product = await Product.findByPk(id);
  if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');

  const snapshot = { name: product.name, sku: product.sku };
  await product.destroy();

  try {
    await AuditService.log({
      userId: auditContext?.userId || null,
      action: ACTIONS.DELETE,
      entity: ENTITIES.PRODUCT,
      entityId: id,
      changes: snapshot,
      ipAddress: auditContext?.ip,
      userAgent: auditContext?.userAgent,
    });
    
    events.emit(PRODUCT_EVENTS.DELETED, {
      productId: id,
      snapshot,
      actingUserId: auditContext?.userId
    });
  } catch (e) {
    logger.error('Failed to log audit or emit event for product deletion:', e);
  }

  return true;
};

exports.bulkDeleteProducts = async (ids, actingUserId = null, auditContext = null) => {
  return Product.sequelize.transaction(async (transaction) => {
    const products = await Product.findAll({
      where: { id: ids },
      transaction,
    });

    if (products.length === 0) {
      throw new AppError('NOT_FOUND', 404, 'No products found to delete');
    }

    await Product.destroy({
      where: { id: ids },
      transaction,
    });

    // Log individual audit logs for each deleted product
    for (const product of products) {
      try {
        await AuditService.log({
          userId: actingUserId,
          action: ACTIONS.DELETE,
          entity: ENTITIES.PRODUCT,
          entityId: product.id,
          changes: { name: product.name, sku: product.sku },
          ipAddress: auditContext?.ip,
          userAgent: auditContext?.userAgent,
        });
      } catch (e) {
        logger.error(`Failed to log audit for product deletion (ID: ${product.id}):`, e);
      }
    }
    
    events.emit(PRODUCT_EVENTS.BULK_DELETED, {
      productIds: ids,
      actingUserId
    });

    return { deletedCount: products.length };
  });
};

exports.bulkUpdateProducts = async (ids, data, actingUserId = null, auditContext = null) => {
  return Product.sequelize.transaction(async (transaction) => {
    const products = await Product.findAll({
      where: { id: ids },
      transaction,
    });

    if (products.length === 0) {
      throw new AppError('NOT_FOUND', 404, 'No products found to update');
    }

    await Product.update(data, {
      where: { id: ids },
      transaction,
    });

    // Log individual audit logs for each updated product
    for (const product of products) {
      try {
        await AuditService.log({
          userId: actingUserId,
          action: ACTIONS.UPDATE,
          entity: ENTITIES.PRODUCT,
          entityId: product.id,
          changes: data,
          ipAddress: auditContext?.ip,
          userAgent: auditContext?.userAgent,
        });
      } catch (e) {
        logger.error(`Failed to log audit for product bulk update (ID: ${product.id}):`, e);
      }
    }
    
    events.emit(PRODUCT_EVENTS.BULK_UPDATED, {
      productIds: ids,
      changes: data,
      actingUserId
    });

    return { updatedCount: products.length };
  });
};

exports.bulkUpdateSale = async (payload, actingUserId = null, auditContext = null) => {
  const { action, productIds, saleType, value, saleStartAt, saleEndAt, saleLabel } = payload;

  if (action === 'apply' && Number(value) <= 0) {
    throw new AppError('VALIDATION_ERROR', 400, 'Discount value must be greater than zero');
  }

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

    const labelPresets = await getLabelPresets();
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
          }, product.price, { labelPresets });

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
          ipAddress: auditContext?.ip,
          userAgent: auditContext?.userAgent,
        });
      } catch (e) {
        logger.error('Failed to log audit for bulk sale update:', e);
      }
    }
    
    events.emit(PRODUCT_EVENTS.BULK_UPDATED, {
      productIds,
      action,
      saleData: action === 'apply' ? { saleType, value, saleStartAt, saleEndAt, saleLabel } : null,
      actingUserId
    });

    return {
      action,
      updatedCount: products.length,
      productIds: products.map((product) => product.id),
    };
  });
};

exports.getRelatedProducts = async (productId, limit = 6) => {
  const baseQuery = (extraWhere = {}, categoryInclude = null) => ({
    where: {
      id: { [Op.ne]: productId },
      status: 'published',
      isEnabled: true,
      ...extraWhere,
    },
    include: [
      { model: ProductImage, as: 'images' },
      { model: Brand, as: 'brand' },
      ...(categoryInclude ? [categoryInclude] : [{ model: Category, as: 'categories' }]),
      { model: Tag, as: 'tags' },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    distinct: true,
  });

  const product = await Product.findByPk(productId, {
    include: [{ model: Category, as: 'categories', attributes: ['id'] }],
    attributes: ['id'],
  });
  if (!product) return [];

  const categoryIds = (product.categories || []).map((c) => c.id);

  let rows;

  if (categoryIds.length > 0) {
    const result = await Product.findAndCountAll(baseQuery({}, {
      model: Category,
      as: 'categories',
      where: { id: { [Op.in]: categoryIds } },
      required: true,
    }));
    rows = result.rows;
  }

  if (!rows || rows.length === 0) {
    const result = await Product.findAndCountAll(baseQuery());
    rows = result.rows;
  }

  const labelPresets = await getLabelPresets();
  const { features } = await SettingsService.getFeatures();
  return rows.map((p) => serializeProductPricing(p, { adminView: false, features }, labelPresets));
};
