'use strict';
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { Media } = require('../index');
const { getPagination, getPagingData } = require('../../utils/pagination');
const AppError = require('../../utils/AppError');

// Respect UPLOAD_DIR env var — works in both local dev and Docker
const UPLOADS_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads');

// Create directories if they don't exist
const ensureDirs = async () => {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.mkdir(path.join(UPLOADS_DIR, 'thumbnails'), { recursive: true });
  await fs.mkdir(path.join(UPLOADS_DIR, 'medium'), { recursive: true });
  await fs.mkdir(path.join(UPLOADS_DIR, 'large'), { recursive: true });
};
ensureDirs();

exports.uploadMedia = async (file) => {
  if (!file) throw new AppError('VALIDATION_ERROR', 400, 'No file provided');

  const fileType = await import('file-type');
  const typeInfo = await fileType.default.fromBuffer(file.buffer);

  if (!typeInfo) throw new AppError('VALIDATION_ERROR', 400, 'Could not determine file type');

  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedMimes.includes(typeInfo.mime)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.');
  }

  const uniqueId = uuidv4();
  const ext = typeInfo.ext;
  const filename = `${uniqueId}.${ext}`;

  const originalPath = path.join(UPLOADS_DIR, filename);
  await fs.writeFile(originalPath, file.buffer);

  // Create resized versions using sharp
  await sharp(file.buffer)
    .resize({ width: 150, withoutEnlargement: true })
    .toFile(path.join(UPLOADS_DIR, 'thumbnails', filename));

  await sharp(file.buffer)
    .resize({ width: 600, withoutEnlargement: true })
    .toFile(path.join(UPLOADS_DIR, 'medium', filename));

  await sharp(file.buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .toFile(path.join(UPLOADS_DIR, 'large', filename));

  const mediaUrl = `/uploads/${filename}`;

  const media = await Media.create({
    url: mediaUrl,
    filename: filename,
    mimeType: typeInfo.mime,
    size: file.size,
    provider: 'local',
  });

  return media;
};

exports.listMedia = async (page, limit) => {
  const { limit: queryLimit, offset } = getPagination(page, limit);
  const { rows, count } = await Media.findAndCountAll({
    limit: queryLimit,
    offset,
    order: [['createdAt', 'DESC']],
  });
  return getPagingData(rows, count, page, queryLimit);
};

exports.deleteMedia = async (id) => {
  const media = await Media.findByPk(id);
  if (!media) throw new AppError('NOT_FOUND', 404, 'Media not found');

  const filename = media.filename;

  const deleteFileSafe = async (filePath) => {
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
    } catch (e) {
      /* ignore */
    }
  };

  await deleteFileSafe(path.join(UPLOADS_DIR, filename));
  await deleteFileSafe(path.join(UPLOADS_DIR, 'thumbnails', filename));
  await deleteFileSafe(path.join(UPLOADS_DIR, 'medium', filename));
  await deleteFileSafe(path.join(UPLOADS_DIR, 'large', filename));

  await media.destroy();
  return true;
};
