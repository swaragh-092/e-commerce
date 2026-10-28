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
  ProductComboItem,
  Sequelize,
  sequelize,
} = require('../index');
const { Op } = Sequelize;
const salePriceIsDiscounted = Sequelize.where(Sequelize.col('Product.sale_price'), Op.lt, Sequelize.col('Product.price'));
const { generateSlug } = require('../../utils/slugify');
// Note: Although the ARCHITECTURE/STANDARDS refer to generateUniqueSlug(),
// the slugify.js utility internally implements the collision-safe loop
// and exports it as generateSlug. This handles duplicates automatically.
const { getPagination, getPagingData } = require('../../utils/pagination');
const sanitizeHtml = require('sanitize-html');
const { syncProductTags, buildTagFilter } = require('./tag.service');
const AuditService = require('../audit/audit.service');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { ACTIONS, ENTITIES } = require('../../config/constants');
const { getCategoryAndDescendantIds } = require('../category/category.service');
const { normalizeSalePayload, serializeProductPricing } = require('./product.pricing');
const {
  applyProductStorefrontFilters,
  buildProductStorefrontCountsWhere,
  mapProductStorefrontCounts,
} = require('./product.storefrontState');
const { events, PRODUCT_EVENTS } = require('../../utils/events');
const { getSaleLabels } = require('../settings/saleLabel.service');
const SettingsService = require('../settings/settings.service');
const inventoryService = require('../inventory/inventory.service');
const { validateProductTypeChange } = require('./productType');
const { normalizeSearchQuery, buildSearchPattern } = require('../search/search.utils');
const {
  isBrandVisible,
  stripBrandFields,
  assertBrandFilterAllowed,
} = require('../../utils/brandVisibility');


// Fetch the active label catalog once per request (the service caches for 60 s)
const getLabelPresets = () => getSaleLabels().catch(() => []);

/**
 * Builds a SQL WHERE condition (string) that evaluates whether a product's sale is active,
 * precisely matching the JS `isSaleActive` logic from product.pricing.js:
 * 1. sale_price IS NOT NULL AND sale_price < price
 * 2. sale_start_at IS NULL OR sale_start_at <= NOW()
 * 3. sale_end_at IS NULL OR sale_end_at >= NOW()
 * 4. Gated on label presets:
 *    - Inactive presets are excluded
 *    - Future preset start dates are excluded unless product has its own sale_start_at
 *    - Expired preset end dates are excluded unless product has its own sale_end_at
 */
const buildSqlSaleCondition = (labelPresets = [], now = new Date(), tableAlias = '"Product"') => {
  const inactiveIds = [];
  const futureIds = [];
  const expiredIds = [];

  for (const preset of labelPresets) {
    if (!preset || !preset.id) continue;
    if (preset.isActive === false) {
      inactiveIds.push(preset.id);
      continue;
    }
    if (preset.startDate) {
      const start = new Date(preset.startDate);
      if (!Number.isNaN(start.getTime()) && start > now) {
        futureIds.push(preset.id);
        continue;
      }
    }
    if (preset.endDate) {
      const end = new Date(preset.endDate);
      if (!Number.isNaN(end.getTime()) && end < now) {
        expiredIds.push(preset.id);
        continue;
      }
    }
  }

  const conditions = [
    `${tableAlias}."sale_price" IS NOT NULL`,
    `${tableAlias}."sale_price" < ${tableAlias}."price"`,
    `(${tableAlias}."sale_start_at" IS NULL OR ${tableAlias}."sale_start_at" <= NOW())`,
    `(${tableAlias}."sale_end_at" IS NULL OR ${tableAlias}."sale_end_at" >= NOW())`,
  ];

  if (inactiveIds.length > 0) {
    const escaped = inactiveIds.map((id) => sequelize.escape(id)).join(',');
    conditions.push(`(${tableAlias}."sale_label" IS NULL OR ${tableAlias}."sale_label" NOT IN (${escaped}))`);
  }

  if (futureIds.length > 0) {
    const escaped = futureIds.map((id) => sequelize.escape(id)).join(',');
    conditions.push(`(${tableAlias}."sale_label" IS NULL OR ${tableAlias}."sale_label" NOT IN (${escaped}) OR ${tableAlias}."sale_start_at" IS NOT NULL)`);
  }

  if (expiredIds.length > 0) {
    const escaped = expiredIds.map((id) => sequelize.escape(id)).join(',');
    conditions.push(`(${tableAlias}."sale_label" IS NULL OR ${tableAlias}."sale_label" NOT IN (${escaped}) OR ${tableAlias}."sale_end_at" IS NOT NULL)`);
  }

  return conditions.join(' AND ');
};

const getSqlEffectivePriceExpr = (labelPresets = [], now = new Date(), tableAlias = '"Product"') => {
  const saleCond = buildSqlSaleCondition(labelPresets, now, tableAlias);
  return Sequelize.literal(`COALESCE(CASE WHEN ${saleCond} THEN ${tableAlias}."sale_price" ELSE ${tableAlias}."price" END, ${tableAlias}."price")`);
};

const buildSqlSaleStatusCondition = (status, labelPresets = [], now = new Date(), tableAlias = '"Product"') => {
  if (status === 'none') {
    return `(${tableAlias}."sale_price" IS NULL OR ${tableAlias}."sale_price" >= ${tableAlias}."price")`;
  }
  if (status === 'active') {
    return buildSqlSaleCondition(labelPresets, now, tableAlias);
  }

  const inactiveIds = [];
  const futureIds = [];
  const expiredIds = [];

  for (const preset of labelPresets) {
    if (!preset || !preset.id) continue;
    if (preset.isActive === false) {
      inactiveIds.push(preset.id);
      continue;
    }
    if (preset.startDate) {
      const start = new Date(preset.startDate);
      if (!Number.isNaN(start.getTime()) && start > now) {
        futureIds.push(preset.id);
        continue;
      }
    }
    if (preset.endDate) {
      const end = new Date(preset.endDate);
      if (!Number.isNaN(end.getTime()) && end < now) {
        expiredIds.push(preset.id);
        continue;
      }
    }
  }

  const notInactiveClause = inactiveIds.length > 0
    ? `(${tableAlias}."sale_label" IS NULL OR ${tableAlias}."sale_label" NOT IN (${inactiveIds.map((id) => sequelize.escape(id)).join(',')}))`
    : null;

  if (status === 'scheduled') {
    const scheduledParts = [`${tableAlias}."sale_start_at" > NOW()`];
    if (futureIds.length > 0) {
      const escaped = futureIds.map((id) => sequelize.escape(id)).join(',');
      scheduledParts.push(`(${tableAlias}."sale_label" IN (${escaped}) AND ${tableAlias}."sale_start_at" IS NULL)`);
    }
    const conds = [
      `${tableAlias}."sale_price" IS NOT NULL`,
      `${tableAlias}."sale_price" < ${tableAlias}."price"`,
      `(${scheduledParts.join(' OR ')})`,
    ];
    if (notInactiveClause) conds.push(notInactiveClause);
    return conds.join(' AND ');
  }

  if (status === 'expired') {
    const expiredParts = [`${tableAlias}."sale_end_at" < NOW()`];
    if (expiredIds.length > 0) {
      const escaped = expiredIds.map((id) => sequelize.escape(id)).join(',');
      expiredParts.push(`(${tableAlias}."sale_label" IN (${escaped}) AND ${tableAlias}."sale_end_at" IS NULL)`);
    }
    const conds = [
      `${tableAlias}."sale_price" IS NOT NULL`,
      `${tableAlias}."sale_price" < ${tableAlias}."price"`,
      `(${expiredParts.join(' OR ')})`,
    ];
    if (notInactiveClause) conds.push(notInactiveClause);
    return conds.join(' AND ');
  }

  return null;
};

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


const ATTRIBUTE_TEMPLATE_FIELDS = ['id', 'name', 'slug', 'sortOrder', 'displayType', 'valueType', 'unit', 'unitCategory'];
const ATTRIBUTE_VALUE_FIELDS = ['id', 'value', 'slug', 'sortOrder', 'displayLabel', 'swatchColor', 'imageUrl', 'unitLabel', 'metadata'];

const getCommonAttributeIncludes = () => [
  { model: AttributeTemplate, as: 'attribute', attributes: ATTRIBUTE_TEMPLATE_FIELDS },
  { model: AttributeValue, as: 'value', attributes: ATTRIBUTE_VALUE_FIELDS },
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
    {
      model: ProductImage,
      as: 'images',
      required: false,
      include: [{ model: Media, as: 'media', required: false }],
    },
  ],
});

const getAttributeInclude = () => ({
  model: ProductAttribute,
  as: 'attributes',
  include: getCommonAttributeIncludes(),
});

const getGlobalImageInclude = () => ({
  model: ProductImage,
  as: 'images',
  required: false,
  where: { variantId: null },
  include: [{ model: Media, as: 'media', required: false }],
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

  const mediaIds = Array.from(new Set(images.map(img => img.mediaId || img.media_id || img.media?.id).filter(Boolean)));
  if (mediaIds.length === 0) return;

  const count = await Media.count({
    where: { id: { [Op.in]: mediaIds } }
  });

  if (count !== mediaIds.length) {
    throw new AppError('VALIDATION_ERROR', 400, 'One or more images reference an invalid media ID');
  }
};

const normalizeImageRows = (images = [], { productId, variantId = null } = {}) => (
  images.map((img, index) => ({
    productId,
    variantId,
    url: img.url || img.media?.url,
    alt: img.alt || null,
    mediaId: img.mediaId || img.media_id || img.media?.id || null,
    sortOrder: Number(img.sortOrder ?? index),
    isPrimary: Boolean(img.isPrimary),
  })).filter((img) => img.url || img.mediaId)
);

const replaceImageRows = async ({ productId, variantId = null, images = [], transaction }) => {
  const rows = normalizeImageRows(images, { productId, variantId });
  const hasPrimary = rows.some((img) => img.isPrimary);

  await ProductImage.destroy({
    where: { productId, variantId },
    transaction,
  });

  if (hasPrimary) {
    await ProductImage.update(
      { isPrimary: false },
      { where: { productId }, transaction }
    );
  }

  if (rows.length > 0) {
    await ProductImage.bulkCreate(rows, { transaction });
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

const getVariantStockTotal = async (productId, transaction = null) => {
  const total = await ProductVariant.sum('stockQty', {
    where: { productId, isActive: true },
    transaction,
  });
  return Number(total || 0);
};

const productHasVariants = async (productId, transaction = null) => {
  const count = await ProductVariant.count({
    where: { productId },
    transaction,
  });
  return count > 0;
};

const syncProductVariantStock = async (productId, transaction = null) => {
  const [stockSum, reservedSum] = await Promise.all([
    ProductVariant.sum('stockQty', {
      where: { productId, isActive: true },
      transaction,
    }),
    ProductVariant.sum('reservedQty', {
      where: { productId },
      paranoid: false,
      transaction,
    }),
  ]);
  const nextReserved = Math.max(Number(reservedSum || 0), 0);
  const nextQuantity = Math.max(Number(stockSum || 0), nextReserved);
  await Product.update(
    { quantity: nextQuantity, reservedQty: nextReserved },
    { where: { id: productId }, transaction }
  );
  return nextQuantity;
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

    if (Array.isArray(variant.images) && variant.images.length > 0) {
      await replaceImageRows({
        productId,
        variantId: createdVariant.id,
        images: variant.images,
        transaction,
      });
      const primaryOrFirst = normalizeImageRows(variant.images, { productId, variantId: createdVariant.id })
        .find((img) => img.isPrimary) || normalizeImageRows(variant.images, { productId, variantId: createdVariant.id })[0];
      if (primaryOrFirst?.mediaId) {
        await createdVariant.update({ mediaId: primaryOrFirst.mediaId }, { transaction });
      }
    }
  }
};

const replaceVariantsWithOptions = async (productId, variants, transaction) => {
  const existingVariants = await ProductVariant.findAll({
    where: { productId },
    attributes: ['id'],
    paranoid: false,
    transaction,
  });

  if (existingVariants.length) throw new AppError('VALIDATION_ERROR', 400, 'Use the variant editor to update existing combinations. Product updates cannot replace variant history.');

  await createVariantsWithOptions(productId, variants, transaction);
};

exports.getProducts = async (filters, page, limit, isAdmin = false) => {
  const { limit: queryLimit, offset } = getPagination(page, limit);
  const where = {};
  const order = [];
  const now = new Date();
  const labelPresets = await getLabelPresets();
  const { features } = await SettingsService.getFeatures();
  const brandsVisible = isBrandVisible(features, { adminView: isAdmin });
  const include = [
    getGlobalImageInclude(),
    { model: Tag, as: 'tags', attributes: { exclude: ['description'] } },
    ...(brandsVisible ? [{ model: Brand, as: 'brand' }] : []),
  ];

  if (filters.brand && !brandsVisible) {
    assertBrandFilterAllowed(features, { adminView: isAdmin });
  }

  // Always restrict storefront results to published + enabled products. Admins can filter by state.
  applyProductStorefrontFilters(where, filters, isAdmin);
  if (typeof filters.hasVariants === 'boolean' || filters.hasVariants === 'true' || filters.hasVariants === 'false') {
    const hasVariants = filters.hasVariants === true || filters.hasVariants === 'true';
    where[Op.and] = [...(where[Op.and] || []), Sequelize.literal(`${hasVariants ? '' : 'NOT '}EXISTS (SELECT 1 FROM "product_variants" AS copy_variant WHERE copy_variant.product_id = "Product".id AND copy_variant.deleted_at IS NULL)`)];
  }

  // Filter Logic
  if (typeof filters.search === 'string' && filters.search.length > 0) {
    const trimmed = normalizeSearchQuery(filters.search);
    if (trimmed) {
      const searchPattern = buildSearchPattern(trimmed);
      const escapedQuery = sequelize.escape(trimmed);
      const escapedSearchPattern = sequelize.escape(searchPattern);
      where[Op.or] = [
        { name: { [Op.iLike]: searchPattern } },
        { description: { [Op.iLike]: searchPattern } },
        { shortDescription: { [Op.iLike]: searchPattern } },
        { sku: { [Op.iLike]: searchPattern } },
        Sequelize.literal(`"Product"."search_vector" @@ plainto_tsquery('simple', ${escapedQuery})`),
        Sequelize.literal(`EXISTS (
          SELECT 1
          FROM "product_categories" AS "search_product_categories"
          INNER JOIN "categories" AS "search_categories"
            ON "search_categories"."id" = "search_product_categories"."category_id"
          WHERE "search_product_categories"."product_id" = "Product"."id"
            AND (
              LOWER("search_categories"."name") LIKE LOWER(${escapedSearchPattern})
              OR LOWER("search_categories"."slug") LIKE LOWER(${escapedSearchPattern})
            )
        )`),
        ...(brandsVisible ? [Sequelize.literal(`EXISTS (
          SELECT 1
          FROM "brands" AS "search_brands"
          WHERE "search_brands"."id" = "Product"."brand_id"
            AND (
              LOWER("search_brands"."name") LIKE LOWER(${escapedSearchPattern})
              OR LOWER("search_brands"."slug") LIKE LOWER(${escapedSearchPattern})
            )
        )`)] : []),
        ...(features.tags ? [Sequelize.literal(`EXISTS (
          SELECT 1
          FROM "product_tags" AS "search_product_tags"
          INNER JOIN "tags" AS "search_tags"
            ON "search_tags"."id" = "search_product_tags"."tag_id"
          WHERE "search_product_tags"."product_id" = "Product"."id"
            AND (
              LOWER("search_tags"."name") LIKE LOWER(${escapedSearchPattern})
              OR LOWER("search_tags"."slug") LIKE LOWER(${escapedSearchPattern})
            )
        )`)] : []),
      ];
    }
  }
  const priceFilterConditions = [];
  if (filters.minPrice || filters.maxPrice) {
    const effectivePriceExpr = getSqlEffectivePriceExpr(labelPresets, now, '"Product"');
    if (filters.minPrice && filters.maxPrice) {
      priceFilterConditions.push(
        Sequelize.where(effectivePriceExpr, { [Op.between]: [Number(filters.minPrice), Number(filters.maxPrice)] })
      );
    } else if (filters.minPrice) {
      priceFilterConditions.push(
        Sequelize.where(effectivePriceExpr, { [Op.gte]: Number(filters.minPrice) })
      );
    } else if (filters.maxPrice) {
      priceFilterConditions.push(
        Sequelize.where(effectivePriceExpr, { [Op.lte]: Number(filters.maxPrice) })
      );
    }
    where[Op.and] = [...(where[Op.and] || []), ...priceFilterConditions];
  }
  if (filters.maxQty !== undefined && filters.maxQty !== null) {
    const maxQty = parseInt(filters.maxQty, 10);
    where[Op.and] = [
      ...(where[Op.and] || []),
      Sequelize.literal(`("Product"."quantity" - "Product"."reserved_qty") <= ${maxQty}`),
    ];
  }
  if (brandsVisible && filters.brand) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.brand);
    if (isUUID) {
      where.brandId = filters.brand;
    } else {
      const brandInclude = include.find((inc) => inc.as === 'brand');
      if (brandInclude) {
        brandInclude.where = { slug: filters.brand };
        brandInclude.required = true;
      }
    }
  }
  if (filters.saleStatus) {
    const statusCond = buildSqlSaleStatusCondition(filters.saleStatus, labelPresets, now, '"Product"');
    if (statusCond) {
      where[Op.and] = [
        ...(where[Op.and] || []),
        Sequelize.literal(statusCond),
      ];
    }
  }

  if (filters.featured === 'true' || filters.featured === true) {
    where.isFeatured = true;
  }
  
  const tagFilter = buildTagFilter(features.tags ? filters.tags : undefined);
  if (tagFilter) where[Op.and] = [...(where[Op.and] || []), tagFilter];

  // sale: salePrice is set AND sale window is active (or no window defined)
  if (filters.onSale === 'true' || filters.onSale === true || filters.sale === 'true' || filters.sale === true) {
    where[Op.and] = [
      ...(where[Op.and] || []),
      Sequelize.literal(buildSqlSaleCondition(labelPresets, now, '"Product"')),
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
  else if (filters.sort === 'discount_desc') {
    const saleCond = buildSqlSaleCondition(labelPresets, now, '"Product"');
    order.push([
      Sequelize.literal(
        `CASE WHEN ${saleCond} THEN ("Product"."price" - "Product"."sale_price") * 100.0 / "Product"."price" ELSE 0 END`
      ),
      'DESC',
    ]);
  }
  else if (filters.sort === 'ending_soon') order.push([Sequelize.literal('CASE WHEN "Product"."sale_end_at" IS NOT NULL THEN "Product"."sale_end_at" ELSE \'2099-12-31\'::timestamp END'), 'ASC']);
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

  const shouldIncludeSubcategories = (() => {
    const raw = filters.includeSubcategories;
    if (raw === undefined || raw === null || raw === '') return true;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw !== 0;
    if (typeof raw === 'string') {
      const s = raw.toLowerCase().trim();
      return !['false', '0', 'no'].includes(s);
    }
    return Boolean(raw);
  })();

  if (filters.categoryId) {
    const categoryIds = shouldIncludeSubcategories
      ? await getCategoryAndDescendantIds(filters.categoryId)
      : [filters.categoryId];
    include.push({
      model: Category,
      as: 'categories',
      where: { id: { [Op.in]: categoryIds } },
      required: true,
    });
    filters._categoryIds = categoryIds;
  } else if (filters.category) {
    const rootCat = await Category.findOne({
      where: { slug: filters.category },
      attributes: ['id'],
    });
    if (rootCat) {
      const categoryIds = shouldIncludeSubcategories
        ? await getCategoryAndDescendantIds(rootCat.id)
        : [rootCat.id];
      include.push({
        model: Category,
        as: 'categories',
        where: { id: { [Op.in]: categoryIds } },
        required: true,
      });
      filters._categoryIds = categoryIds;
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

  // Compute actual price range for the current filter context (excluding minPrice/maxPrice)
  const priceRangeWhere = { ...where };
  delete priceRangeWhere.price;
  if (priceFilterConditions.length > 0 && Array.isArray(priceRangeWhere[Op.and])) {
    priceRangeWhere[Op.and] = priceRangeWhere[Op.and].filter(
      (c) => !priceFilterConditions.includes(c)
    );
  }

  // Translate relationship includes into direct WHERE subqueries for the aggregation query
  if (filters._categoryIds?.length) {
    const escapedIds = filters._categoryIds.map(id => sequelize.escape(id)).join(',');
    priceRangeWhere[Op.and] = [
      ...(priceRangeWhere[Op.and] || []),
      Sequelize.literal(`"Product"."id" IN (SELECT "product_id" FROM "product_categories" WHERE "category_id" IN (${escapedIds}))`),
    ];
  }

  const effectivePriceCol = getSqlEffectivePriceExpr(labelPresets, now, '"Product"');
  const priceRangeResult = await Product.findOne({
    where: priceRangeWhere,
    attributes: [
      [Sequelize.fn('MIN', effectivePriceCol), 'min'],
      [Sequelize.fn('MAX', effectivePriceCol), 'max'],
    ],
    raw: true,
  });

  const priceRange = {
    min: priceRangeResult?.min != null ? Number(priceRangeResult.min) : 0,
    max: priceRangeResult?.max != null ? Number(priceRangeResult.max) : 0,
  };

  let counts = {};
  if (isAdmin) {
    const countWhere = buildProductStorefrontCountsWhere(where, filters);

    // For status counts, we need to preserve any required includes (joins used for filtering)
    // like categories or tags, but strip out attributes to keep it light.
    const countInclude = include
      .filter(inc => inc.required)
      .map(inc => {
        const mapped = { 
          ...inc, 
          attributes: [],
        };
        // Only many-to-many relationships (tags, categories) have junction tables that need 'through' attribute stripping
        if (['tags', 'categories'].includes(inc.as)) {
          mapped.through = { attributes: [] };
        }
        return mapped;
      });

    const statusCounts = await Product.findAll({
      where: countWhere,
      include: countInclude,
      attributes: [
        'status',
        'isEnabled',
        [Sequelize.fn('COUNT', Sequelize.literal('DISTINCT "Product"."id"')), 'count']
      ],
      group: ['Product.status', 'Product.is_enabled'],
      subQuery: false, // Prevent complex subqueries that break GROUP BY
      raw: true
    });
    
    counts = mapProductStorefrontCounts(statusCounts);

    // Low stock count
    const catalogSettings = await SettingsService.getByGroup('catalog', { maskSensitive: false });
    const lowStockThreshold = parseInt(catalogSettings.lowStockThreshold, 10) || 10;
    counts.lowStock = await Product.count({
      where: Sequelize.literal(`"Product"."quantity" - "Product"."reserved_qty" <= ${lowStockThreshold}`),
    });
  }

  const serializedRows = rows.map((row) => {
    const serialized = serializeProductPricing(row, { adminView: isAdmin, features }, labelPresets);
    return brandsVisible ? serialized : stripBrandFields(serialized);
  });
  
  const pagingData = getPagingData(serializedRows, count, page, queryLimit);
  const shouldHidePrice = !isAdmin && (features.pricing === false || features.showPrice === false);
  pagingData.priceRange = shouldHidePrice ? null : priceRange;
  if (isAdmin) {
    pagingData.counts = counts;
  }
  return pagingData;
};

exports.getProductBySlug = async (slug, { adminView = false } = {}) => {
  const { features } = await SettingsService.getFeatures();
  const brandsVisible = isBrandVisible(features, { adminView });
  const where = { slug };
  if (!adminView) {
    where.status = 'published';
    where.isEnabled = true;
  }
  const product = await Product.findOne({
    where,
    include: [
      getGlobalImageInclude(),
      getVariantInclude(),
      getAttributeInclude(),
      { model: Category, as: 'categories' },
      { model: Tag, as: 'tags', attributes: { exclude: ['description'] } },
      ...(brandsVisible ? [{ model: Brand, as: 'brand' }] : []),
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
  const serialized = serializeProductPricing(product, { adminView, features }, labelPresets);
  return brandsVisible ? serialized : stripBrandFields(serialized);
};

exports.getProductById = async (id) => {
  const product = await Product.findByPk(id, {
    include: [
      getGlobalImageInclude(),
      getVariantInclude(),
      getAttributeInclude(),
      { model: Category, as: 'categories' },
      { model: Tag, as: 'tags', attributes: { exclude: ['description'] } },
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

const validateShippingReadiness = (data, existingProduct = null, shippingEnabled = true) => {
  if (!shippingEnabled) return;
  const status = data.status !== undefined ? data.status : existingProduct?.status;
  if (status !== 'published') return;

  const requiresShipping = data.requiresShipping !== undefined
    ? data.requiresShipping
    : (existingProduct?.requiresShipping !== false);
  if (requiresShipping === false) return;

  const weightGrams = data.weightGrams !== undefined ? data.weightGrams : existingProduct?.weightGrams;
  const lengthCm = data.lengthCm !== undefined ? data.lengthCm : existingProduct?.lengthCm;
  const breadthCm = data.breadthCm !== undefined ? data.breadthCm : existingProduct?.breadthCm;
  const heightCm = data.heightCm !== undefined ? data.heightCm : existingProduct?.heightCm;

  const missing = [];
  if (!Number.isFinite(Number(weightGrams)) || Number(weightGrams) <= 0) {
    missing.push('weight (greater than 0 g)');
  }
  if (!Number.isFinite(Number(lengthCm)) || Number(lengthCm) <= 0.5) {
    missing.push('length (greater than 0.5 cm)');
  }
  if (!Number.isFinite(Number(breadthCm)) || Number(breadthCm) <= 0.5) {
    missing.push('breadth (greater than 0.5 cm)');
  }
  if (!Number.isFinite(Number(heightCm)) || Number(heightCm) <= 0.5) {
    missing.push('height (greater than 0.5 cm)');
  }

  if (missing.length > 0) {
    const productName = data.name || existingProduct?.name || 'Product';
    throw new AppError(
      'SHIPPING_READINESS_ERROR',
      400,
      `Cannot publish "${productName}": physical products requiring shipping must have ${missing.join(', ')} before becoming purchasable.`
    );
  }
};

const validateSellingReadiness = (data, existingProduct = null, pricingEnabled = true) => {
  if (!pricingEnabled) return;
  const status = data.status !== undefined ? data.status : existingProduct?.status;
  if (status !== 'published') return;
  const price = data.price !== undefined ? data.price : existingProduct?.price;
  if (price === null || price === undefined || !Number.isFinite(Number(price)) || Number(price) <= 0) {
    throw new AppError('PRODUCT_NOT_READY', 400, 'Set a positive selling price before publishing this product.');
  }
};

exports.createProduct = async (data, auditContext = null) => {
  const transaction = await Product.sequelize.transaction();
  try {
    const labelPresets = await getLabelPresets();
    const { features: createFeatures } = await SettingsService.getFeatures();
    // Catalog mode has no selling price. Accept legacy clients that send zero
    // as an empty-price placeholder, then store the canonical NULL value.
    if (!createFeatures.pricing && data.price != null && Number(data.price) === 0) {
      data.price = null;
    }
    data = normalizeSalePayload(data, null, { labelPresets, pricingEnabled: createFeatures.pricing });
    if (data.type !== 'simple') {
      if (data.quantity !== undefined) throw new AppError('VALIDATION_ERROR', 400, 'Stock is managed by variants or bundle items for this product type.');
      if (data.type !== 'variable' && data.variants?.length) throw new AppError('VALIDATION_ERROR', 400, 'Only Variable Products can have variants.');
      data.quantity = 0;
    } else if (data.variants?.length) {
      throw new AppError('VALIDATION_ERROR', 400, 'Only Variable Products can have variants.');
    }
    const slug = data.slug ? await generateSlug(data.slug, Product, 'slug', { transaction }) : await generateSlug(data.name, Product, 'slug', { transaction });

    if (data.description) data.description = sanitizeRichText(data.description);

    if (data.brandId) {
      const brand = await Brand.findByPk(data.brandId);
      if (!brand) throw new AppError('NOT_FOUND', 404, 'Brand not found');
    }

    validateProductStock(data);
    validateSellingReadiness(data, null, createFeatures.pricing);
    validateShippingReadiness(data, null, createFeatures.shipping);
    if (data.images) await validateProductImages(data.images);

    const product = await Product.create({ ...data, slug }, { transaction });

    if (data.categoryIds && data.categoryIds.length) {
      await product.setCategories(data.categoryIds, { transaction });
    }

    if (data.variants && data.variants.length) {
      await createVariantsWithOptions(product.id, data.variants, transaction);
      await syncProductVariantStock(product.id, transaction);
    }

    if (data.images && data.images.length) {
      await replaceImageRows({ productId: product.id, images: data.images, transaction });
    }

    await syncProductTags(product, createFeatures.tags ? data.tags : undefined, transaction);

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
  let product = await Product.findByPk(id);
  if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');

  const transaction = await Product.sequelize.transaction();
  try {
    const labelPresets = await getLabelPresets();
    const { features: updateFeatures } = await SettingsService.getFeatures();
    // Match generation/inventory lock order and serialize type changes with generation.
    await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:scope), hashtext(:productId))', {
      replacements: { scope: 'product-variant-generation', productId: id }, transaction,
    });
    await ProductVariant.findAll({ where: { productId: id }, order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
    product = await Product.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');

    // Preserve omitted prices during edits. Only normalize an explicitly
    // supplied zero while pricing is disabled; the products constraint allows
    // NULL but rejects zero.
    if (!updateFeatures.pricing && data.price != null && Number(data.price) === 0) {
      data.price = null;
    }
    data = normalizeSalePayload(data, product, { labelPresets, pricingEnabled: updateFeatures.pricing });
    
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

    const variantsExist = await productHasVariants(id, transaction);
    const hasComboItems = await ProductComboItem.count({ where: { comboProductId: id }, transaction }) > 0;
    const { nextType, resetInventory } = validateProductTypeChange(product, data, { hasVariants: variantsExist, hasComboItems });
    if (variantsExist && data.variants !== undefined) throw new AppError('VALIDATION_ERROR', 400, 'Use the variant editor to update existing combinations. Product updates cannot replace variant history.');
    delete data.confirmInventoryReset;
    if ((nextType !== 'simple' || variantsExist) && data.quantity !== undefined) {
      throw new AppError('VALIDATION_ERROR', 400, 'Stock is managed by variants or bundle items. Edit their stock instead.');
    }
    if (resetInventory) {
      await inventoryService.adjust({ productId: id, newQuantity: 0, reason: `Change inventory type from simple to ${nextType}`, createdBy: auditContext?.userId || null, transaction });
    }
    validateProductStock(data, product);
    validateSellingReadiness(data, product, updateFeatures.pricing);
    validateShippingReadiness(data, product, updateFeatures.shipping);
    if (data.images) await validateProductImages(data.images);

    // Log inventory ADJUSTMENT if quantity is being manually changed
    const stockChanged = data.quantity !== undefined && Number(data.quantity) !== Number(product.quantity || 0);
    const adjustmentReason = data.stockAdjustmentReason;
    delete data.stockAdjustmentReason;

    if (stockChanged && !variantsExist) {
      await inventoryService.adjust({
        productId: id,
        newQuantity: Number(data.quantity),
        reason: adjustmentReason || 'Admin manual adjustment',
        createdBy: auditContext?.userId || null,
        metadata: { source: 'product_update' },
        transaction,
      });
      // Remove quantity from data since adjust() already updated it
      delete data.quantity;
    }

    await product.update(data, { transaction });

    if (data.categoryIds) {
      await product.setCategories(data.categoryIds, { transaction });
    }

    if (data.variants) {
      await replaceVariantsWithOptions(id, data.variants, transaction);
      await syncProductVariantStock(id, transaction);
    } else if (nextType === 'variable') {
      await syncProductVariantStock(id, transaction);
    }

    if (data.images) {
      await replaceImageRows({ productId: id, images: data.images, transaction });
    }

    await syncProductTags(product, updateFeatures.tags ? data.tags : undefined, transaction);

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
  const labelPresets = await getLabelPresets();
  const touchesPricingOrSale = ['price', 'salePrice', 'saleStartAt', 'saleEndAt', 'saleLabel'].some((k) => k in data);
  let updatePayload = { ...data };

  return Product.sequelize.transaction(async (transaction) => {
    const products = await Product.findAll({
      where: { id: ids },
      transaction,
    });

    if (products.length === 0) {
      throw new AppError('NOT_FOUND', 404, 'No products found to update');
    }

    const { features: bulkFeatures } = await SettingsService.getFeatures();
    if (!bulkFeatures.pricing && data.price != null && Number(data.price) === 0) {
      data.price = null;
    }

    if (touchesPricingOrSale) {
      for (const product of products) {
        const normalized = normalizeSalePayload(data, product, { labelPresets, pricingEnabled: bulkFeatures.pricing });
        for (const key of ['saleLabel', 'salePrice', 'saleStartAt', 'saleEndAt', 'price']) {
          if (key in data) {
            updatePayload[key] = normalized[key];
          }
        }
        if ('salePrice' in data && data.salePrice === null) {
          updatePayload.saleStartAt = null;
          updatePayload.saleEndAt = null;
          updatePayload.saleLabel = null;
        }
      }
    }

    if (updatePayload.status === 'published') {
      for (const product of products) {
        validateSellingReadiness(updatePayload, product, bulkFeatures.pricing);
        validateShippingReadiness(updatePayload, product, bulkFeatures.shipping);
      }
    }

    await Product.update(updatePayload, {
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
          changes: updatePayload,
          ipAddress: auditContext?.ip,
          userAgent: auditContext?.userAgent,
        });
      } catch (e) {
        logger.error(`Failed to log audit for product bulk update (ID: ${product.id}):`, e);
      }
    }
    
    events.emit(PRODUCT_EVENTS.BULK_UPDATED, {
      productIds: ids,
      changes: updatePayload,
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
      lock: transaction.LOCK.UPDATE,
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
  const { features } = await SettingsService.getFeatures();
  const brandsVisible = isBrandVisible(features);
  const baseQuery = (extraWhere = {}, categoryInclude = null) => ({
    where: {
      id: { [Op.ne]: productId },
      status: 'published',
      isEnabled: true,
      ...extraWhere,
    },
    include: [
      { model: ProductImage, as: 'images' },
      ...(brandsVisible ? [{ model: Brand, as: 'brand' }] : []),
      ...(categoryInclude ? [categoryInclude] : [{ model: Category, as: 'categories' }]),
      { model: Tag, as: 'tags', attributes: { exclude: ['description'] } },
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
  return rows.map((p) => {
    const serialized = serializeProductPricing(p, { adminView: false, features }, labelPresets);
    return brandsVisible ? serialized : stripBrandFields(serialized);
  });
};

exports.buildSqlSaleCondition = buildSqlSaleCondition;
exports.getSqlEffectivePriceExpr = getSqlEffectivePriceExpr;
exports.buildSqlSaleStatusCondition = buildSqlSaleStatusCondition;
exports.validateShippingReadiness = validateShippingReadiness;
