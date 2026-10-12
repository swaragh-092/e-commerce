'use strict';
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { Media } = require('../index');
const { getPagination, getPagingData } = require('../../utils/pagination');
const AppError = require('../../utils/AppError');

const logger = require('../../utils/logger');

const { getStorageProvider } = require('../../utils/storage');

const storage = getStorageProvider();

exports.uploadMedia = async (file) => {
  if (!file) throw new AppError('VALIDATION_ERROR', 400, 'No file provided');

  const { fileTypeFromBuffer } = await import('file-type');
  const typeInfo = await fileTypeFromBuffer(file.buffer);

  if (!typeInfo) throw new AppError('VALIDATION_ERROR', 400, 'Could not determine file type');

  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedMimes.includes(typeInfo.mime)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.');
  }

  const uniqueId = uuidv4();
  const ext = typeInfo.ext;
  const filename = `${uniqueId}.${ext}`;
  const webpFilename = `${uniqueId}.webp`;

  // Reject decompression bombs before doing any resize work. The upload middleware
  // independently caps compressed bytes; this cap limits decoded pixel memory/CPU.
  const imageOptions = { limitInputPixels: 40_000_000 };

  const resizeAndSave = async (width, folder) => {
    const pipeline = sharp(file.buffer, imageOptions)
      .resize({ width, withoutEnlargement: true })
      .toFormat('webp', { quality: 80 });
    const buffer = await pipeline.toBuffer();
    return storage.save(buffer, webpFilename, folder);
  };

  // Finish processing first so invalid/unsupported image data is not persisted.
  await resizeAndSave(150, 'thumbnails');
  await resizeAndSave(600, 'medium');
  await resizeAndSave(1200, 'large');

  const mediaUrl = await storage.save(file.buffer, filename);

  const media = await Media.create({
    url: mediaUrl,
    filename: filename,
    originalName: file.originalname,
    mimeType: typeInfo.mime,
    size: file.size,
    provider: process.env.STORAGE_PROVIDER || 'local',
  });

  return media;
};

exports.uploadFont = async (file) => {
  if (!file) throw new AppError('VALIDATION_ERROR', 400, 'No file provided');

  const allowedExtensions = ['.woff2', '.woff', '.ttf', '.otf'];
  const ext = (file.originalname || '').slice((file.originalname || '').lastIndexOf('.')).toLowerCase();

  if (!allowedExtensions.includes(ext)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid font file type. Only WOFF2, WOFF, TTF, and OTF are allowed.');
  }

  const { fileTypeFromBuffer } = await import('file-type');
  const typeInfo = await fileTypeFromBuffer(file.buffer);
  if (!typeInfo || !allowedExtensions.includes(`.${typeInfo.ext}`) || `.${typeInfo.ext}` !== ext) {
    throw new AppError('VALIDATION_ERROR', 400, 'Font contents do not match a supported WOFF2, WOFF, TTF, or OTF file.');
  }

  const uniqueId = uuidv4();
  const filename = `${uniqueId}${ext}`;
  const fontUrl = await storage.save(file.buffer, filename, 'fonts');

  const media = await Media.create({
    url: fontUrl,
    filename: filename,
    originalName: file.originalname,
    mimeType: typeInfo.mime,
    size: file.size,
    provider: process.env.STORAGE_PROVIDER || 'local',
  });

  return media;
};

exports.listMedia = async (page, limit, sortBy = 'createdAt', sortDir = 'DESC') => {
  const { limit: queryLimit, offset } = getPagination(page, limit);
  
  // Map frontend sort names to database columns
  const sortMap = {
    date: 'created_at',
    size: 'size',
    name: 'original_name',
    filename: 'filename',
    createdAt: 'created_at'
  };

  const orderCol = sortMap[sortBy] || 'created_at';
  const orderDir = sortDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const { rows, count } = await Media.findAndCountAll({
    limit: queryLimit,
    offset,
    order: [[orderCol, orderDir]],
  });
  return getPagingData(rows, count, page, queryLimit);
};

exports.deleteMedia = async (id) => {
  const mediaRecord = await Media.findByPk(id);
  if (!mediaRecord) throw new AppError('NOT_FOUND', 404, 'Media not found');

  const filename = mediaRecord.filename;
  const webpFilename = filename.split('.').slice(0, -1).join('.') + '.webp';

  // Delete original
  await storage.delete(filename);

  // Delete resized versions (try both original ext and webp)
  const folders = ['thumbnails', 'medium', 'large'];
  for (const folder of folders) {
    await storage.delete(filename, folder);
    await storage.delete(webpFilename, folder);
  }

  await mediaRecord.destroy();
  return true;
};

exports.updateMedia = async (id, data) => {
  const media = await Media.findByPk(id);
  if (!media) throw new AppError('NOT_FOUND', 404, 'Media not found');

  const { alt, description, caption, originalName } = data;
  
  await media.update({ 
    alt, 
    description, 
    caption,
    originalName: originalName || media.originalName
  });

  return media;
};
