'use strict';

/**
 * Search Repository — raw database queries for product search.
 *
 * WHY a separate repository layer:
 * - Isolates raw SQL / Sequelize query logic from business logic (service).
 * - Makes it easy to swap the search backend later (e.g. Elasticsearch)
 *   without touching the service or controller layers.
 * - Keeps the service layer testable with simple mocks.
 *
 * SECURITY:
 * - All user input goes through Sequelize bind parameters ($queryText).
 * - plainto_tsquery() is inherently safe — it treats the entire input as
 *   plain text, not as tsquery syntax. No metacharacters are interpreted.
 * - This is fundamentally different from to_tsquery() which DOES interpret
 *   operators like | & ! and could be abused.
 */

const {
  Product,
  ProductImage,
  Brand,
  Category,
  Tag,
  Sequelize,
} = require('../index');

const { Op } = Sequelize;

const SHARED_INCLUDES = [
  {
    model: ProductImage,
    as: 'images',
    attributes: ['id', 'url', 'alt', 'isPrimary', 'sortOrder', 'mediaId'],
  },
  {
    model: Brand,
    as: 'brand',
    attributes: ['id', 'name', 'slug'],
  },
  {
    model: Category,
    as: 'categories',
    attributes: ['id', 'name', 'slug'],
    through: { attributes: [] },
  },
  {
    model: Tag,
    as: 'tags',
    attributes: ['id', 'name', 'slug'],
    through: { attributes: [] },
  },
];

const PUBLISHED_WHERE = {
  status: 'published',
  isEnabled: true,
  deletedAt: null,
};

// Threshold below which we activate the trigram similarity fallback.
// 3 or fewer FTS results suggests the user may have a typo or the product
// name uses a non-standard spelling that stemming can't match.
const TRIGRAM_FALLBACK_THRESHOLD = 3;

// Minimum similarity score for a trigram match to be considered relevant.
const TRIGRAM_MIN_SIMILARITY = 0.2;

const ftsWhere = (queryText) => ({
  ...PUBLISHED_WHERE,
  [Op.and]: [
    Sequelize.literal(`"Product"."search_vector" @@ plainto_tsquery('simple', $queryText)`),
  ],
});

const ftsRelevance = (queryText) => [
  Sequelize.literal(`ts_rank("Product"."search_vector", plainto_tsquery('simple', $queryText))`),
  'relevance',
];

const trigramWhere = (queryText) => ({
  ...PUBLISHED_WHERE,
  [Op.or]: [
    Sequelize.literal(`similarity("Product"."name", $queryText) > ${TRIGRAM_MIN_SIMILARITY}`),
    Sequelize.literal(`similarity("Product"."sku", $queryText) > 0.3`),
  ],
});

const trigramRelevance = (queryText) => [
  Sequelize.literal(`GREATEST(similarity("Product"."name", $queryText), similarity("Product"."sku", $queryText))`),
  'relevance',
];

const baseQueryOptions = (queryText, limit, offset, relevanceAttr, whereClause) => ({
  where: whereClause,
  attributes: {
    exclude: ['search_vector'],
    include: [relevanceAttr],
  },
  include: SHARED_INCLUDES,
  bind: { queryText },
  order: [
    [Sequelize.literal('"relevance"'), 'DESC'],
    ['createdAt', 'DESC'],
  ],
  limit,
  offset,
  distinct: true,
  subQuery: false,
});

/**
 * Search products using PostgreSQL Full-Text Search with trigram fallback.
 *
 * Strategy:
 * 1. Primary: ts_rank via GIN index on search_vector — sub-millisecond.
 * 2. Fallback: If FTS returns ≤ TRIGRAM_FALLBACK_THRESHOLD results, run a
 *    trigram similarity query and merge unique results. This catches typos
 *    ("smasung"), partial SKU entries, and words outside the search_vector.
 *
 * @param {string} queryText - The user's search query (already validated/trimmed)
 * @param {number} limit - Max results per page
 * @param {number} offset - Pagination offset
 * @returns {{ rows: Product[], count: number }}
 */
const searchProducts = async (queryText, limit, offset) => {
  const ftsResults = await Product.unscoped().findAndCountAll(
    baseQueryOptions(queryText, limit, offset, ftsRelevance(queryText), ftsWhere(queryText))
  );

  // Fast path: FTS returned enough results — no fallback needed
  if (ftsResults.rows.length > TRIGRAM_FALLBACK_THRESHOLD) {
    return { rows: ftsResults.rows, count: ftsResults.count };
  }

  // Trigram fallback: FTS returned few results — try fuzzy matching
  try {
    const trigramResults = await Product.unscoped().findAndCountAll(
      baseQueryOptions(queryText, limit, offset, trigramRelevance(queryText), trigramWhere(queryText))
    );

    if (trigramResults.rows.length === 0) {
      return { rows: ftsResults.rows, count: ftsResults.count };
    }

    // Merge results, preferring FTS results, deduplicating by ID
    const ftsIds = new Set(ftsResults.rows.map((r) => r.id));
    const merged = [
      ...ftsResults.rows,
      ...trigramResults.rows.filter((r) => !ftsIds.has(r.id)),
    ];

    // Count: use the larger of the two totals. We can't precisely deduplicate
    // total counts without an extra query, but since FTS had ≤ threshold results,
    // the trigram count is the better estimate. Using max avoids undercounting.
    // Note: ftsResults.rows.length is page-level (≤ limit) and must NOT be
    // subtracted from total counts — that mixes page and aggregate scopes.
    return {
      rows: merged.slice(0, limit),
      count: Math.max(ftsResults.count, trigramResults.count),
    };
  } catch (_err) {
    // pg_trgm extension may not be installed — return FTS results as-is
    return { rows: ftsResults.rows, count: ftsResults.count };
  }
};

/**
 * Search brands by name using trigram similarity.
 *
 * @param {string} queryText
 * @param {number} limit
 * @returns {Brand[]}
 */
const searchBrands = async (queryText, limit = 5) => {
  try {
    return await Brand.findAll({
      where: {
        isActive: true,
        [Op.and]: [
          Sequelize.literal(`name % $queryText`),
        ],
      },
      attributes: ['id', 'name', 'slug', 'image'],
      order: [[Sequelize.literal(`similarity(name, $queryText)`), 'DESC']],
      limit,
      bind: { queryText },
    });
  } catch (_err) {
    return [];
  }
};

/**
 * Search categories by name using trigram similarity.
 *
 * @param {string} queryText
 * @param {number} limit
 * @returns {Category[]}
 */
const searchCategories = async (queryText, limit = 5) => {
  try {
    // Note: Category currently lacks visibility filters (isActive/status) in the schema.
    // If these are added later, they should be included here.
    return await Category.findAll({
      where: Sequelize.literal(`name % $queryText`),
      attributes: ['id', 'name', 'slug', 'image'],
      order: [[Sequelize.literal(`similarity(name, $queryText)`), 'DESC']],
      limit,
      bind: { queryText },
    });
  } catch (_err) {
    return [];
  }
};

/**
 * Suggest a spelling correction for zero-result queries.
 *
 * Uses trigram similarity to find the closest matching product, brand,
 * or category name. Returns the best match if similarity exceeds a
 * minimum threshold — otherwise null.
 *
 * @param {string} queryText
 * @returns {string|null} suggested correction, or null
 */
const suggestCorrection = async (queryText) => {
  const MIN_CORRECTION_SIMILARITY = 0.2; // Catch common typos even on short words
  const normalizedQuery = queryText.toLowerCase();

  try {
    // Search across all three tables in one query per table, pick best match
    // Use word_similarity for better matching against longer names
    const [productMatch] = await Product.unscoped().findAll({
      where: {
        status: 'published',
        isEnabled: true,
        deletedAt: null,
      },
      attributes: [
        'name',
        [Sequelize.literal(`word_similarity(LOWER(name), $normalizedQuery)`), 'score'],
      ],
      order: [[Sequelize.literal('score'), 'DESC']],
      limit: 1,
      bind: { normalizedQuery },
      raw: true,
    });

    const [brandMatch] = await Brand.findAll({
      where: { isActive: true },
      attributes: [
        'name',
        [Sequelize.literal(`word_similarity(LOWER(name), $normalizedQuery)`), 'score'],
      ],
      order: [[Sequelize.literal('score'), 'DESC']],
      limit: 1,
      bind: { normalizedQuery },
      raw: true,
    });

    const [categoryMatch] = await Category.findAll({
      // Note: Category currently lacks visibility filters (isActive/status) in the schema.
      attributes: [
        'name',
        [Sequelize.literal(`word_similarity(LOWER(name), $normalizedQuery)`), 'score'],
      ],
      order: [[Sequelize.literal('score'), 'DESC']],
      limit: 1,
      bind: { normalizedQuery },
      raw: true,
    });

    const best = [productMatch, brandMatch, categoryMatch]
      .filter(Boolean)
      .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))[0];

    if (best && parseFloat(best.score) >= MIN_CORRECTION_SIMILARITY) {
      return best.name;
    }

    return null;
  } catch (_err) {
    return null;
  }
};

module.exports = { searchProducts, searchBrands, searchCategories, suggestCorrection };
