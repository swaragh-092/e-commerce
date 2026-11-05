'use strict';
const sharp = require('sharp');
const { createHash } = require('node:crypto');
const { Media } = require('../index');
const { getStorageProvider } = require('../../utils/storage');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const storage = getStorageProvider();
const formats = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
const options = { limitInputPixels: 40_000_000 };

async function renditions(bytes, filename) {
  const name = filename.replace(/\.[^.]+$/, '') + '.webp';
  const result = [{ bytes, filename, folder: '' }];
  for (const [width, folder] of [[150, 'thumbnails'], [600, 'medium'], [1200, 'large']]) {
    result.push({ bytes: await sharp(bytes, options).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(), filename: name, folder });
  }
  return result;
}

async function change(id, file, revert) {
  const transaction = await Media.sequelize.transaction();
  let previous;
  let writing = false;
  try {
    const media = await Media.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!media) throw new AppError('NOT_FOUND', 404, 'Media not found');
    if (!formats[media.mimeType] || (media.provider && media.provider !== 'local')) {
      throw new AppError('VALIDATION_ERROR', 400, 'Only local JPEG, PNG and WebP images can be updated.');
    }
    const current = await storage.read(media.filename);
    if ((await sharp(current, options).metadata()).pages > 1) {
      throw new AppError('VALIDATION_ERROR', 400, 'Animated images cannot be edited without losing animation.');
    }
    let bytes;
    if (revert) {
      try { bytes = await storage.readOriginal(media.filename); }
      catch (error) { if (error.code === 'ENOENT') throw new AppError('NOT_FOUND', 404, 'No saved original is available for this image.'); throw error; }
    } else {
      if (!file?.buffer) throw new AppError('VALIDATION_ERROR', 400, 'Choose an edited image to save.');
      const { fileTypeFromBuffer } = await import('file-type');
      const type = await fileTypeFromBuffer(file.buffer);
      if (!type || !formats[type.mime]) throw new AppError('VALIDATION_ERROR', 400, 'Choose a JPEG, PNG or WebP image.');
      // Preserve the format as well as filename/URL for references saved outside Media.
      bytes = await sharp(file.buffer, options).rotate().toFormat(formats[media.mimeType]).toBuffer();
      if (bytes.length > 5 * 1024 * 1024) throw new AppError('VALIDATION_ERROR', 400, 'The edited image exceeds 5 MB. Choose a smaller output size.');
    }
    const next = await renditions(bytes, media.filename);
    previous = await renditions(current, media.filename);
    // Private write-once backup is durable before any public bytes change.
    await storage.retainOriginal(media.filename, current);
    writing = true;
    for (const item of next) await storage.saveAtomic(item.bytes, item.filename, item.folder);
    await media.update({ size: bytes.length, contentHash: createHash('sha256').update(bytes).digest('hex'), isEdited: !revert }, { transaction });
    await transaction.commit();
    return media;
  } catch (error) {
    if (writing && previous) {
      for (const item of previous) {
        try { await storage.saveAtomic(item.bytes, item.filename, item.folder); }
        catch (restoreError) { logger.error('Could not restore media after a failed edit', { filename: item.filename, error: restoreError.message }); }
      }
    }
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
}
exports.replace = (id, file) => change(id, file, false);
exports.revert = id => change(id, null, true);
