'use strict';
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { Media } = require('../index');
const { getPagination, getPagingData } = require('../../utils/pagination');

// Navigate out from server/src/modules/media to server/uploads
const UPLOADS_DIR = path.join(__dirname, '../../../../uploads');

// Create directories if they don't exist
const ensureDirs = async () => {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(path.join(UPLOADS_DIR, 'thumbnails'), { recursive: true });
    await fs.mkdir(path.join(UPLOADS_DIR, 'medium'), { recursive: true });
    await fs.mkdir(path.join(UPLOADS_DIR, 'large'), { recursive: true });
};
ensureDirs();

exports.uploadMedia = async (file) => {
    if (!file) throw new Error('No file provided');

    const { fileTypeFromBuffer } = await import('file-type');
    const typeInfo = await fileTypeFromBuffer(file.buffer);

    if (!typeInfo) throw new Error('Could not determine file type');
    
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimes.includes(typeInfo.mime)) {
        throw new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.');
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
        provider: 'local'
    });

    return media;
};

exports.listMedia = async (page, limit) => {
    const { limit: queryLimit, offset } = getPagination(page, limit);
    const { rows, count } = await Media.findAndCountAll({
        limit: queryLimit,
        offset,
        order: [['createdAt', 'DESC']]
    });
    return getPagingData(rows, count, page, queryLimit);
};

exports.deleteMedia = async (id) => {
    const media = await Media.findByPk(id);
    if (!media) throw new Error('Media not found');

    const filename = media.filename;
    
    const deleteFileSafe = async (filePath) => {
        try {
            await fs.access(filePath);
            await fs.unlink(filePath);
        } catch(e) { /* ignore */ }
    };

    await deleteFileSafe(path.join(UPLOADS_DIR, filename));
    await deleteFileSafe(path.join(UPLOADS_DIR, 'thumbnails', filename));
    await deleteFileSafe(path.join(UPLOADS_DIR, 'medium', filename));
    await deleteFileSafe(path.join(UPLOADS_DIR, 'large', filename));

    await media.destroy();
    return true;
};
