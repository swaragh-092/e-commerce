'use strict';

const { BlogCategory, BlogPost, BlogPostCategory, User, Media, Gallery, GalleryItem, Sequelize } = require('../index');
const { Op } = Sequelize;
const { generateSlug } = require('../../utils/slugify');
const { getPagination, getPagingData } = require('../../utils/pagination');
const { sanitizePageContent } = require('../../middleware/sanitize.middleware');
const { sanitizePlainText } = require('../../middleware/sanitize.middleware');
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');
const logger = require('../../utils/logger');
const { ACTIONS } = require('../../config/constants');

const BLOG_POST_ENTITY = 'BlogPost';
const BLOG_CATEGORY_ENTITY = 'BlogCategory';
let galleryColumnSupportPromise = null;
let galleryColumnSupported = true;

const normalizeNullable = (value) => {
  if (value === '' || value === undefined) return null;
  return value;
};

const getPostGallerySlug = (post) => `${post.slug}-gallery`;

const findGalleryForPost = async (post, transaction) => {
  if (galleryColumnSupported && post.galleryId) {
    const gallery = await Gallery.findByPk(post.galleryId, { transaction });
    if (gallery) return gallery;
  }

  return Gallery.findOne({
    where: { slug: getPostGallerySlug(post) },
    transaction,
  });
};

const loadGalleryDetail = async (galleryId, transaction) => {
  if (!galleryId) return null;

  return Gallery.findByPk(galleryId, {
    attributes: ['id', 'title', 'slug', 'description'],
    include: [{
      model: GalleryItem,
      as: 'items',
      separate: true,
      order: [['priority', 'ASC'], ['createdAt', 'ASC']],
      include: [{ model: Media, as: 'media' }],
    }],
    transaction,
  });
};

const syncPostGallery = async (post, mediaIds = [], transaction) => {
  const uniqueMediaIds = [...new Set((mediaIds || []).filter(Boolean))];
  let gallery = await findGalleryForPost(post, transaction);

  if (gallery && galleryColumnSupported && !post.galleryId) {
    await post.update({ galleryId: gallery.id }, { transaction });
    post.setDataValue('galleryId', gallery.id);
  }

  if (!gallery && uniqueMediaIds.length > 0) {
    gallery = await Gallery.create({
      title: `${post.title || 'Blog'} Gallery`,
      slug: getPostGallerySlug(post),
      description: `Gallery for blog post ${post.title || post.slug}`,
      isActive: true,
    }, { transaction });

    if (galleryColumnSupported) {
      await post.update({ galleryId: gallery.id }, { transaction });
      post.setDataValue('galleryId', gallery.id);
    }
  }

  if (!gallery) return;

  if (uniqueMediaIds.length === 0) {
    await GalleryItem.destroy({
      where: { galleryId: gallery.id },
      transaction,
    });

    if (galleryColumnSupported && post.galleryId) {
      await post.update({ galleryId: null }, { transaction });
      post.setDataValue('galleryId', null);
    }

    await gallery.destroy({ transaction });
    return;
  }

  await gallery.update({
    title: `${post.title || 'Blog'} Gallery`,
    description: `Gallery for blog post ${post.title || post.slug}`,
    isActive: true,
  }, { transaction });

  const existingItems = await GalleryItem.findAll({
    where: { galleryId: gallery.id },
    transaction,
  });

  const existingByMediaId = new Map(existingItems.map((item) => [item.mediaId, item]));
  const incomingMediaSet = new Set(uniqueMediaIds);

  for (const item of existingItems) {
    if (!incomingMediaSet.has(item.mediaId)) {
      await item.destroy({ transaction });
    }
  }

  for (let index = 0; index < uniqueMediaIds.length; index += 1) {
    const mediaId = uniqueMediaIds[index];
    const existingItem = existingByMediaId.get(mediaId);
    if (existingItem) {
      await existingItem.update({ priority: index }, { transaction });
    } else {
      await GalleryItem.create({
        galleryId: gallery.id,
        mediaId,
        priority: index,
      }, { transaction });
    }
  }
};

const attachGalleryFallback = async (post) => {
  if (!post) return post;
  if (post.gallery?.items) return post;

  try {
    const fallbackGallery = await findGalleryForPost(post);
    const gallery = await loadGalleryDetail(fallbackGallery?.id);

    if (gallery) {
      post.setDataValue('gallery', gallery);
      if (galleryColumnSupported && !post.galleryId) {
        post.setDataValue('galleryId', gallery.id);
      }
    }
  } catch (error) {
    logger.error(`Failed to attach fallback gallery for blog post ${post.id || post.slug}:`, error);
  }

  return post;
};

const ensureGalleryColumnSupport = async () => {
  galleryColumnSupportPromise = galleryColumnSupportPromise || (async () => {
    try {
      const table = await BlogPost.sequelize.getQueryInterface().describeTable('blog_posts');
      galleryColumnSupported = Boolean(table?.gallery_id);

      if (!galleryColumnSupported && BlogPost.rawAttributes.galleryId) {
        BlogPost.removeAttribute('galleryId');
      }
    } catch (error) {
      logger.error('Failed to inspect blog_posts schema for gallery_id support:', error);
      galleryColumnSupported = false;
      if (BlogPost.rawAttributes.galleryId) {
        BlogPost.removeAttribute('galleryId');
      }
    }
  })();

  await galleryColumnSupportPromise;
  return galleryColumnSupported;
};

const buildGalleryListInclude = () => ({
  model: Gallery,
  as: 'gallery',
  attributes: ['id', 'title', 'slug', 'description'],
});

const buildGalleryDetailInclude = () => ({
  model: Gallery,
  as: 'gallery',
  attributes: ['id', 'title', 'slug', 'description'],
  include: [{
    model: GalleryItem,
    as: 'items',
    separate: true,
    order: [['priority', 'ASC'], ['createdAt', 'ASC']],
    include: [{ model: Media, as: 'media' }],
  }],
});

const buildDetailInclude = () => ([
  { model: User, as: 'author', attributes: ['id', 'firstName', 'lastName', 'email'] },
  { model: Media, as: 'featuredImage', attributes: ['id', 'url', 'alt', 'caption'] },
  { model: BlogCategory, as: 'categories', attributes: ['id', 'name', 'slug'], through: { attributes: [] } },
  ...(galleryColumnSupported ? [buildGalleryDetailInclude()] : []),
]);

const buildListInclude = () => ([
  { model: User, as: 'author', attributes: ['id', 'firstName', 'lastName', 'email'] },
  { model: Media, as: 'featuredImage', attributes: ['id', 'url', 'alt', 'caption'] },
  { model: BlogCategory, as: 'categories', attributes: ['id', 'name', 'slug'], through: { attributes: [] }, required: false },
  ...(galleryColumnSupported ? [buildGalleryListInclude()] : []),
]);

exports.getCategories = async () => {
  await ensureGalleryColumnSupport();
  return BlogCategory.findAll({
    order: [['name', 'ASC']],
  });
};

exports.getCategoryBySlug = async (slug) => {
  await ensureGalleryColumnSupport();
  const category = await BlogCategory.findOne({
    where: { slug },
    include: [{
      model: BlogPost,
      as: 'posts',
      through: { attributes: [] },
      where: {
        status: 'published',
        publishedAt: { [Op.lte]: new Date() },
      },
      required: false,
      include: buildDetailInclude(),
      order: [['publishedAt', 'DESC'], ['createdAt', 'DESC']],
    }],
  });

  if (!category) throw new AppError('NOT_FOUND', 404, 'Blog category not found');
  return category;
};

exports.createCategory = async (payload, actingUserId = null) => {
  await ensureGalleryColumnSupport();
  const slug = await generateSlug(payload.name, BlogCategory, 'slug');
  const category = await BlogCategory.create({
    name: payload.name,
    slug,
    description: normalizeNullable(payload.description),
  });

  try {
    await AuditService.log({
      userId: actingUserId,
      action: ACTIONS.CREATE,
      entity: BLOG_CATEGORY_ENTITY,
      entityId: category.id,
      changes: { name: category.name, slug: category.slug },
    });
  } catch (e) {
    logger.error('Failed to log audit for blog category creation:', e);
  }

  return category;
};

exports.updateCategory = async (id, payload, actingUserId = null) => {
  await ensureGalleryColumnSupport();
  const category = await BlogCategory.findByPk(id);
  if (!category) throw new AppError('NOT_FOUND', 404, 'Blog category not found');

  if (payload.name && payload.name !== category.name) {
    payload.slug = await generateSlug(payload.name, BlogCategory, 'slug');
  }
  if ('description' in payload) {
    payload.description = normalizeNullable(payload.description);
  }

  await category.update(payload);

  try {
    await AuditService.log({
      userId: actingUserId,
      action: ACTIONS.UPDATE,
      entity: BLOG_CATEGORY_ENTITY,
      entityId: category.id,
      changes: payload,
    });
  } catch (e) {
    logger.error('Failed to log audit for blog category update:', e);
  }

  return category;
};

exports.deleteCategory = async (id, actingUserId = null) => {
  await ensureGalleryColumnSupport();
  const category = await BlogCategory.findByPk(id);
  if (!category) throw new AppError('NOT_FOUND', 404, 'Blog category not found');

  const snapshot = { name: category.name, slug: category.slug };
  await category.destroy();

  try {
    await AuditService.log({
      userId: actingUserId,
      action: ACTIONS.DELETE,
      entity: BLOG_CATEGORY_ENTITY,
      entityId: id,
      changes: snapshot,
    });
  } catch (e) {
    logger.error('Failed to log audit for blog category delete:', e);
  }

  return true;
};

exports.getPosts = async (filters, page, limit, isAdmin = false) => {
  await ensureGalleryColumnSupport();
  const { limit: queryLimit, offset } = getPagination(page, limit);
  const where = {};
  const include = buildListInclude();

  if (!isAdmin) {
    where.status = 'published';
    where.publishedAt = { [Op.lte]: new Date() };
  } else if (filters.status) {
    where.status = filters.status;
  }

  if (filters.search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${filters.search}%` } },
      { summary: { [Op.iLike]: `%${filters.search}%` } },
      { content: { [Op.iLike]: `%${filters.search}%` } },
    ];
  }

  if (filters.categorySlug) {
    const categoriesInclude = include.find((entry) => entry.as === 'categories');
    if (categoriesInclude) {
      categoriesInclude.where = { slug: filters.categorySlug };
      categoriesInclude.required = true;
    }
  }

  const { rows, count } = await BlogPost.findAndCountAll({
    where,
    include,
    order: [['displayDate', 'DESC'], ['publishedAt', 'DESC'], ['createdAt', 'DESC']],
    limit: queryLimit,
    offset,
    distinct: true,
  });

  return getPagingData(rows, count, page, queryLimit);
};

exports.getPostBySlug = async (slug) => {
  await ensureGalleryColumnSupport();
  const post = await BlogPost.findOne({
    where: {
      slug,
      status: 'published',
      publishedAt: { [Op.lte]: new Date() },
    },
    include: buildDetailInclude(),
  });
  if (!post) throw new AppError('NOT_FOUND', 404, 'Blog post not found');
  return attachGalleryFallback(post);
};

exports.getPostById = async (id) => {
  await ensureGalleryColumnSupport();
  const post = await BlogPost.findByPk(id, { include: buildDetailInclude() });
  if (!post) throw new AppError('NOT_FOUND', 404, 'Blog post not found');
  return attachGalleryFallback(post);
};

exports.createPost = async (payload, actingUserId = null) => {
  await ensureGalleryColumnSupport();
  const transaction = await BlogPost.sequelize.transaction();
  try {
    const slug = await generateSlug(payload.title, BlogPost, 'slug', { transaction });
    const status = payload.status || 'draft';
    const requestedPublishedAt = normalizeNullable(payload.publishedAt);
    const publishedAt = status === 'published' ? (requestedPublishedAt || new Date()) : requestedPublishedAt;

    const post = await BlogPost.create({
      title: payload.title,
      slug,
      content: sanitizePageContent(payload.content),
      summary: sanitizePlainText(normalizeNullable(payload.summary)),
      featuredImageId: normalizeNullable(payload.featuredImageId),
      authorId: actingUserId,
      status,
      publishedAt,
      displayDate: normalizeNullable(payload.displayDate),
      metaTitle: sanitizePlainText(normalizeNullable(payload.metaTitle)),
      metaDescription: sanitizePlainText(normalizeNullable(payload.metaDescription)),
      metaKeywords: sanitizePlainText(normalizeNullable(payload.metaKeywords)),
    }, { transaction });

    if (Array.isArray(payload.categoryIds) && payload.categoryIds.length > 0) {
      const uniqueIds = [...new Set(payload.categoryIds)];
      await post.setCategories(uniqueIds, { transaction });
    }

    if (Array.isArray(payload.galleryMediaIds)) {
      await syncPostGallery(post, payload.galleryMediaIds, transaction);
    }

    await transaction.commit();

    try {
      await AuditService.log({
        userId: actingUserId,
        action: ACTIONS.CREATE,
        entity: BLOG_POST_ENTITY,
        entityId: post.id,
        changes: { title: post.title, slug: post.slug },
      });
    } catch (e) {
      logger.error('Failed to log audit for blog post creation:', e);
    }

    const createdPost = await BlogPost.findByPk(post.id, { include: buildDetailInclude() });
    return attachGalleryFallback(createdPost);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

exports.updatePost = async (id, payload, actingUserId = null) => {
  await ensureGalleryColumnSupport();
  const post = await BlogPost.findByPk(id);
  if (!post) throw new AppError('NOT_FOUND', 404, 'Blog post not found');

  const transaction = await BlogPost.sequelize.transaction();
  try {
    const updateData = { ...payload };
    if (updateData.title && updateData.title !== post.title) {
      updateData.slug = await generateSlug(updateData.title, BlogPost, 'slug', { transaction });
    }

    if ('content' in updateData) updateData.content = sanitizePageContent(updateData.content);
    if ('summary' in updateData) updateData.summary = sanitizePlainText(normalizeNullable(updateData.summary));
    if ('metaTitle' in updateData) updateData.metaTitle = sanitizePlainText(normalizeNullable(updateData.metaTitle));
    if ('metaDescription' in updateData) updateData.metaDescription = sanitizePlainText(normalizeNullable(updateData.metaDescription));
    if ('metaKeywords' in updateData) updateData.metaKeywords = sanitizePlainText(normalizeNullable(updateData.metaKeywords));
    if ('featuredImageId' in updateData) updateData.featuredImageId = normalizeNullable(updateData.featuredImageId);
    if ('publishedAt' in updateData) updateData.publishedAt = normalizeNullable(updateData.publishedAt);
    if ('displayDate' in updateData) updateData.displayDate = normalizeNullable(updateData.displayDate);
    const nextStatus = updateData.status || post.status;
    if (nextStatus === 'published') {
      updateData.publishedAt = updateData.publishedAt || post.publishedAt || new Date();
    }

    const { categoryIds, galleryMediaIds, ...postFields } = updateData;
    await post.update(postFields, { transaction });

    if (Array.isArray(categoryIds)) {
      const uniqueIds = [...new Set(categoryIds)];
      await post.setCategories(uniqueIds, { transaction });
    }

    if (Array.isArray(galleryMediaIds)) {
      await syncPostGallery(post, galleryMediaIds, transaction);
    }

    await transaction.commit();

    try {
      await AuditService.log({
        userId: actingUserId,
        action: ACTIONS.UPDATE,
        entity: BLOG_POST_ENTITY,
        entityId: post.id,
        changes: updateData,
      });
    } catch (e) {
      logger.error('Failed to log audit for blog post update:', e);
    }

    const updatedPost = await BlogPost.findByPk(post.id, { include: buildDetailInclude() });
    return attachGalleryFallback(updatedPost);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

exports.deletePost = async (id, actingUserId = null) => {
  await ensureGalleryColumnSupport();
  const post = await BlogPost.findByPk(id);
  if (!post) throw new AppError('NOT_FOUND', 404, 'Blog post not found');

  const snapshot = { title: post.title, slug: post.slug };
  const transaction = await BlogPost.sequelize.transaction();

  try {
    const gallery = await findGalleryForPost(post, transaction);
    if (gallery) {
      await GalleryItem.destroy({
        where: { galleryId: gallery.id },
        transaction,
      });
      await gallery.destroy({ transaction });
    }

    await post.destroy({ transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  try {
    await AuditService.log({
      userId: actingUserId,
      action: ACTIONS.DELETE,
      entity: BLOG_POST_ENTITY,
      entityId: id,
      changes: snapshot,
    });
  } catch (e) {
    logger.error('Failed to log audit for blog post delete:', e);
  }

  return true;
};
