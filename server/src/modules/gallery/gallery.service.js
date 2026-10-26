'use strict';
const { Op } = require('sequelize');
const { Gallery, GalleryItem, Media, sequelize } = require('../index');
const { getPagination, getPagingData } = require('../../utils/pagination');
const AppError = require('../../utils/AppError');

const imageAttributes = ['id', 'url', 'alt', 'caption', 'mimeType'];
const coverInclude = { model: Media, as: 'coverImage', attributes: imageAttributes, required: false, where: { mimeType: { [Op.like]: 'image/%' } } };

const includeItems = [coverInclude, {
  model: GalleryItem,
  as: 'items',
  separate: true,
  order: [['priority', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
  include: [{ model: Media, as: 'media' }],
}];

exports.listAdmin = async (page, limit) => {
  const { limit: queryLimit, offset } = getPagination(page, limit);
  const { rows, count } = await Gallery.findAndCountAll({ where: { isShowcase: true }, limit: queryLimit, offset, order: [['createdAt', 'DESC']], include: includeItems });
  return getPagingData(rows, count, page, queryLimit);
};

exports.listPublic = async () => {
  const galleries = await Gallery.findAll({
    where: { isActive: true, isShowcase: true },
    attributes: ['id', 'title', 'slug', 'description'],
    order: [['createdAt', 'ASC'], ['id', 'ASC']],
    include: [coverInclude, {
      model: GalleryItem, as: 'items', separate: true, limit: 1,
      attributes: ['id', 'galleryId', 'mediaId', 'priority', 'createdAt'],
      order: [['priority', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
      include: [{ model: Media, as: 'media', attributes: imageAttributes, required: true,
        where: { mimeType: { [Op.like]: 'image/%' } } }],
    }],
  });
  return galleries.map((row) => {
    const { items, coverImage, ...gallery } = row.toJSON();
    return { ...gallery, coverImage: coverImage || items?.[0]?.media || null };
  });
};

const validateCoverImage = async (mediaId) => {
  if (!mediaId) return;
  const media = await Media.findByPk(mediaId);
  if (!media?.mimeType?.startsWith('image/')) {
    throw new AppError('VALIDATION_ERROR', 400, 'Cover photo must be an existing image');
  }
};

exports.createGallery = async (data) => {
  const existing = await Gallery.findOne({ where: { slug: data.slug } });
  if (existing) throw new AppError('CONFLICT', 409, 'Gallery slug already exists');
  await validateCoverImage(data.coverMediaId);
  return Gallery.create({ ...data, isShowcase: true });
};

exports.updateGallery = async (id, data) => {
  const gallery = await Gallery.findOne({ where: { id, isShowcase: true } });
  if (!gallery) throw new AppError('NOT_FOUND', 404, 'Gallery not found');
  if (data.slug && data.slug !== gallery.slug) {
    const conflict = await Gallery.findOne({ where: { slug: data.slug, id: { [Op.ne]: id } } });
    if (conflict) throw new AppError('CONFLICT', 409, 'Gallery slug already exists');
  }
  await validateCoverImage(data.coverMediaId);
  await gallery.update(data);
  return Gallery.findByPk(id, { include: includeItems });
};

exports.deleteGallery = async (id) => {
  const gallery = await Gallery.findOne({ where: { id, isShowcase: true } });
  if (!gallery) throw new AppError('NOT_FOUND', 404, 'Gallery not found');
  await gallery.destroy();
};

exports.addItems = async (galleryId, mediaIds = []) => {
  await sequelize.transaction(async (transaction) => {
    const gallery = await Gallery.findOne({ where: { id: galleryId, isShowcase: true }, transaction, lock: transaction.LOCK.UPDATE });
    if (!gallery) throw new AppError('NOT_FOUND', 404, 'Gallery not found');
    const uniqueIds = [...new Set(mediaIds)];
    const media = await Media.findAll({ where: { id: { [Op.in]: uniqueIds } }, transaction });
    if (media.length !== uniqueIds.length || media.some((item) => !item.mimeType?.startsWith('image/'))) {
      throw new AppError('VALIDATION_ERROR', 400, 'Gallery items must be existing images');
    }
    const existing = await GalleryItem.findAll({ where: { galleryId }, transaction });
    const existingIds = new Set(existing.map((item) => item.mediaId));
    let nextPriority = existing.reduce((max, item) => Math.max(max, item.priority), -1) + 1;
    for (const mediaId of uniqueIds) {
      if (existingIds.has(mediaId)) continue;
      await GalleryItem.create({ galleryId, mediaId, priority: nextPriority++ }, { transaction });
    }
  });
  return Gallery.findByPk(galleryId, { include: includeItems });
};

exports.removeItem = async (galleryId, itemId) => {
  const gallery = await Gallery.findOne({ where: { id: galleryId, isShowcase: true } });
  if (!gallery) throw new AppError('NOT_FOUND', 404, 'Gallery not found');
  const item = await GalleryItem.findOne({ where: { id: itemId, galleryId } });
  if (!item) throw new AppError('NOT_FOUND', 404, 'Gallery item not found');
  await item.destroy();
};

exports.reorderItems = async (galleryId, itemIds = []) => {
  await sequelize.transaction(async (transaction) => {
    const gallery = await Gallery.findOne({ where: { id: galleryId, isShowcase: true }, transaction, lock: transaction.LOCK.UPDATE });
    if (!gallery) throw new AppError('NOT_FOUND', 404, 'Gallery not found');
    const items = await GalleryItem.findAll({ where: { galleryId }, transaction, lock: transaction.LOCK.UPDATE });
    const existingIds = new Set(items.map((item) => item.id));
    if (new Set(itemIds).size !== itemIds.length || itemIds.some((id) => !existingIds.has(id)) || itemIds.length !== items.length) {
      throw new AppError('VALIDATION_ERROR', 400, 'itemIds must contain all gallery item ids exactly once');
    }
    for (let i = 0; i < itemIds.length; i += 1) {
      await GalleryItem.update({ priority: i }, { where: { id: itemIds[i], galleryId }, transaction });
    }
  });

  return Gallery.findByPk(galleryId, { include: includeItems });
};

exports.getPublicGallery = async (slug, page, limit) => {
  const gallery = await Gallery.findOne({ where: { slug, isActive: true, isShowcase: true } });
  if (!gallery) throw new AppError('NOT_FOUND', 404, 'Gallery not found');

  const { limit: queryLimit, offset } = getPagination(page, limit);
  const { rows, count } = await GalleryItem.findAndCountAll({
    where: { galleryId: gallery.id },
    include: [{ model: Media, as: 'media', required: true, where: { mimeType: { [Op.like]: 'image/%' } } }],
    order: [['priority', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
    limit: queryLimit,
    offset,
  });

  return {
    gallery,
    paging: getPagingData(rows, count, page, queryLimit),
  };
};
