'use strict';
const { randomUUID } = require('crypto');
const { Tag, Product, ProductTag, Media, sequelize, Sequelize } = require('../index');
const { Op } = Sequelize;
const { generateSlug } = require('../../utils/slugify');
const AppError = require('../../utils/AppError');
const { MAX_TAGS, normalizeTagName, normalizeTagNames, tagKey } = require('./tag.utils');

// Shared by product saves and dictionary writes. Held only until transaction end.
const lockTagDictionary = (transaction) => sequelize.query(
  "SELECT pg_advisory_xact_lock(hashtext('product-tag-dictionary'))", { transaction }
);
const findByName = (name, transaction) => Tag.findOne({
  where: Sequelize.where(Sequelize.fn('lower', Sequelize.fn('trim', Sequelize.col('name'))), tagKey(name)),
  order: [['createdAt', 'ASC'], ['id', 'ASC']],
  transaction,
});
const imageInclude = { model: Media, as: 'image', attributes: ['id', 'url', 'alt'], required: false };
const validateImage = async (imageId, transaction) => {
  if (imageId === undefined || imageId === null) return;
  const image = await Media.findByPk(imageId, { transaction });
  if (!image || image.type !== 'image' || !image.mimeType?.startsWith('image/')) {
    throw new AppError('VALIDATION_ERROR', 400, 'Select an image from the Media Library.');
  }
};
const createTag = async (name, transaction, description = '', imageId) => {
  const base = (await generateSlug(name)).slice(0, 60) || `tag-${randomUUID()}`;
  const slug = await generateSlug(base, Tag, 'slug', { transaction });
  return Tag.create({ name, slug, description: description ?? '', ...(imageId !== undefined && { imageId }) }, { transaction });
};
const resolveTags = async (names, transaction) => {
  await lockTagDictionary(transaction);
  const tags = [];
  // One transaction/connection: sequential writes also prevent same-request collisions.
  for (const name of normalizeTagNames(names)) {
    tags.push(await findByName(name, transaction) || await createTag(name, transaction));
  }
  return tags;
};
const syncProductTags = async (product, names, transaction) => {
  if (names === undefined) return;
  const tags = await resolveTags(names, transaction);
  await product.setTags(tags, { transaction });
};
const productCountSql = '(SELECT COUNT(*)::int FROM product_tags pt JOIN products p ON p.id = pt.product_id WHERE pt.tag_id = "Tag".id AND p.deleted_at IS NULL)';
const listTags = async ({ search, page = 1, limit = 20, usage = 'all', sortBy = 'name', sortDir = 'asc' }) => {
  const where = search ? { name: { [Op.iLike]: `%${search.replace(/[\\%_]/g, '\\$&')}%` } } : {};
  if (usage === 'used' || usage === 'unused') {
    where[Op.and] = [Sequelize.literal(`${productCountSql} ${usage === 'used' ? '> 0' : '= 0'}`)];
  }
  const direction = sortDir === 'desc' ? 'DESC' : 'ASC';
  return Tag.findAndCountAll({
    include: [imageInclude],
    where, limit, offset: (page - 1) * limit,
    order: [[sortBy === 'products' ? Sequelize.literal(productCountSql) : 'name', direction], ['id', 'ASC']],
    attributes: { include: [[Sequelize.literal(productCountSql), 'productCount']] },
  });
};
// Only tags attached to currently visible products have public landing pages.
const publicTagPredicate = () => Sequelize.literal(`EXISTS (
  SELECT 1 FROM product_tags pt JOIN products p ON p.id = pt.product_id
  WHERE pt.tag_id = "Tag".id AND p.status = 'published'
    AND p.is_enabled = TRUE AND p.deleted_at IS NULL
)`);
const getPublicTagBySlug = async (slug) => {
  const tag = await Tag.findOne({
    attributes: ['id', 'name', 'slug', 'description', 'imageId'],
    include: [imageInclude],
    where: { slug, [Op.and]: [publicTagPredicate()] },
  });
  if (!tag) throw new AppError('NOT_FOUND', 404, 'Tag not found.');
  return tag;
};
const getPublicTags = () => Tag.findAll({
  attributes: ['slug'], where: { [Op.and]: [publicTagPredicate()] }, order: [['slug', 'ASC']],
});
const addTag = (name, description = '', imageId) => sequelize.transaction(async (transaction) => {
  await lockTagDictionary(transaction);
  name = normalizeTagName(name);
  if (await findByName(name, transaction)) throw new AppError('CONFLICT', 409, 'A tag with this name already exists.');
  await validateImage(imageId, transaction);
  return createTag(name, transaction, description, imageId);
});
const renameTag = (id, name, description, imageId) => sequelize.transaction(async (transaction) => {
  await lockTagDictionary(transaction);
  const tag = await Tag.findByPk(id, { transaction });
  if (!tag) throw new AppError('NOT_FOUND', 404, 'Tag not found.');
  name = normalizeTagName(name);
  const existing = await findByName(name, transaction);
  if (existing && existing.id !== id) throw new AppError('CONFLICT', 409, 'A tag with this name already exists.');
  await validateImage(imageId, transaction);
  return tag.update({ name, ...(imageId !== undefined && { imageId }), ...(description !== undefined && { description: description ?? '' }) }, { transaction });
});
const deleteTag = (id) => sequelize.transaction(async (transaction) => {
  await lockTagDictionary(transaction);
  const tag = await Tag.findByPk(id, { transaction });
  if (!tag) throw new AppError('NOT_FOUND', 404, 'Tag not found.');
  await tag.destroy({ transaction });
});
const bulkUpdateProductTags = ({ productIds, action, tags: names }) => sequelize.transaction(async (transaction) => {
  const ids = [...new Set(productIds.map((id) => id.toLowerCase()))].sort();
  // Match the product-save lock order: products first, then the tag dictionary.
  // Sorting locks also makes overlapping bulk requests acquire rows consistently.
  const products = await Product.findAll({
    attributes: ['id'], where: { id: { [Op.in]: ids } },
    order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE,
  });
  if (products.length !== ids.length) {
    throw new AppError('CONFLICT', 409, 'Some selected products no longer exist. Refresh the list and select products again.');
  }

  let tags;
  if (action === 'add') {
    tags = await resolveTags(names, transaction);
  } else {
    await lockTagDictionary(transaction);
    // Removal must never create dictionary entries, including for unknown names.
    tags = await Tag.findAll({
      attributes: ['id'],
      where: Sequelize.where(
        Sequelize.fn('lower', Sequelize.fn('trim', Sequelize.col('name'))),
        { [Op.in]: normalizeTagNames(names).map(tagKey) }
      ),
      transaction,
    });
  }
  const current = await ProductTag.findAll({
    attributes: ['productId', 'tagId'], where: { productId: { [Op.in]: ids } }, transaction,
  });
  const byProduct = new Map(ids.map((id) => [id, new Set()]));
  current.forEach((link) => byProduct.get(link.productId).add(link.tagId));
  const tagIds = tags.map((tag) => tag.id).sort();
  const changedProducts = new Set();
  let changedCount = 0;

  if (action === 'add') {
    const additions = [];
    for (const id of ids) {
      const existing = byProduct.get(id);
      const missing = tagIds.filter((tagId) => !existing.has(tagId));
      if (missing.length && existing.size + missing.length > MAX_TAGS) {
        throw new AppError('VALIDATION_ERROR', 400, 'Adding these tags would exceed the 50-tag limit on a selected product. No products were changed.');
      }
      missing.forEach((tagId) => additions.push({ productId: id, tagId }));
      if (missing.length) changedProducts.add(id);
    }
    if (additions.length) await ProductTag.bulkCreate(additions, { transaction, ignoreDuplicates: true });
    changedCount = additions.length;
  } else {
    const removing = new Set(tagIds);
    current.forEach((link) => {
      if (removing.has(link.tagId)) { changedProducts.add(link.productId); changedCount += 1; }
    });
    if (changedCount) await ProductTag.destroy({
      where: { productId: { [Op.in]: ids }, tagId: { [Op.in]: tagIds } }, transaction,
    });
  }
  return { selectedCount: ids.length, updatedCount: changedProducts.size, changedCount };
});

// Names remain supported for existing API consumers; slugs are canonical in links.
const buildTagFilter = (value) => {
  const tags = (Array.isArray(value) ? value : (value || '').split(',')).map((tag) => tag.trim()).filter(Boolean);
  if (!tags.length) return null;
  const escaped = tags.map((tag) => sequelize.escape(tag)).join(',');
  return Sequelize.literal(`"Product"."id" IN (SELECT pt.product_id FROM product_tags pt JOIN tags t ON t.id = pt.tag_id WHERE t.slug IN (${escaped}) OR (t.name IN (${escaped}) AND NOT EXISTS (SELECT 1 FROM tags canonical_tag WHERE canonical_tag.slug = t.name)))`);
};
module.exports = { resolveTags, syncProductTags, listTags, addTag, renameTag, deleteTag, buildTagFilter, bulkUpdateProductTags, getPublicTagBySlug, getPublicTags };
