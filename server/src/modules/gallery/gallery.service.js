'use strict';
const { Op } = require('sequelize');
const { Gallery, GalleryItem, Media, sequelize } = require('../index');
const { getPagination, getPagingData } = require('../../utils/pagination');
const AppError = require('../../utils/AppError');

const includeItems = [{
  model: GalleryItem,
  as: 'items',
  separate: true,
  order: [['priority', 'ASC'], ['createdAt', 'ASC']],
  include: [{ model: Media, as: 'media' }],
}];

exports.listAdmin = async (page, limit) => {
  const { limit: queryLimit, offset } = getPagination(page, limit);
  const { rows, count } = await Gallery.findAndCountAll({ limit: queryLimit, offset, order: [['createdAt', 'DESC']], include: includeItems });
  return getPagingData(rows, count, page, queryLimit);
};

exports.createGallery = async (data) => {
  const existing = await Gallery.findOne({ where: { slug: data.slug } });
  if (existing) throw new AppError('CONFLICT', 409, 'Gallery slug already exists');
  return Gallery.create(data);
};

exports.updateGallery = async (id, data) => {
  const gallery = await Gallery.findByPk(id);
  if (!gallery) throw new AppError('NOT_FOUND', 404, 'Gallery not found');
  await gallery.update(data);
  return gallery;
};

exports.deleteGallery = async (id) => {
  const gallery = await Gallery.findByPk(id);
  if (!gallery) throw new AppError('NOT_FOUND', 404, 'Gallery not found');
  await gallery.destroy();
};

exports.addItems = async (galleryId, mediaIds = []) => {
  const gallery = await Gallery.findByPk(galleryId);
  if (!gallery) throw new AppError('NOT_FOUND', 404, 'Gallery not found');

  const maxPriority = await GalleryItem.max('priority', { where: { galleryId } });
  let nextPriority = Number.isFinite(maxPriority) ? maxPriority + 1 : 0;

  for (const mediaId of mediaIds) {
    const [item] = await GalleryItem.findOrCreate({
      where: { galleryId, mediaId },
      defaults: { priority: nextPriority },
    });
    if (item.isNewRecord) nextPriority += 1;
  }

  return Gallery.findByPk(galleryId, { include: includeItems });
};

exports.removeItem = async (galleryId, itemId) => {
  const item = await GalleryItem.findOne({ where: { id: itemId, galleryId } });
  if (!item) throw new AppError('NOT_FOUND', 404, 'Gallery item not found');
  await item.destroy();
};

exports.reorderItems = async (galleryId, itemIds = []) => {
  const items = await GalleryItem.findAll({ where: { galleryId } });
  const existingIds = new Set(items.map((item) => item.id));
  if (itemIds.some((id) => !existingIds.has(id)) || itemIds.length !== items.length) {
    throw new AppError('VALIDATION_ERROR', 400, 'itemIds must contain all gallery item ids exactly once');
  }

  await sequelize.transaction(async (transaction) => {
    for (let i = 0; i < itemIds.length; i += 1) {
      await GalleryItem.update({ priority: i }, { where: { id: itemIds[i], galleryId }, transaction });
    }
  });

  return Gallery.findByPk(galleryId, { include: includeItems });
};

exports.getPublicGallery = async (slug, page, limit) => {
  const gallery = await Gallery.findOne({ where: { slug, isActive: true } });
  if (!gallery) throw new AppError('NOT_FOUND', 404, 'Gallery not found');

  const { limit: queryLimit, offset } = getPagination(page, limit);
  const { rows, count } = await GalleryItem.findAndCountAll({
    where: { galleryId: gallery.id },
    include: [{ model: Media, as: 'media' }],
    order: [['priority', 'ASC'], ['createdAt', 'ASC']],
    limit: queryLimit,
    offset,
  });

  return {
    gallery,
    paging: getPagingData(rows, count, page, queryLimit),
  };
};
