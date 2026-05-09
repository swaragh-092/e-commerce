'use strict';
const path = require('path');
const fs = require('fs').promises;
const logger = require('../logger');

class LocalStorage {
    getUploadsDir() {
        return path.resolve(process.env.UPLOAD_DIR || 'uploads');
    }

    async ensureDirs() {
        const uploadsDir = this.getUploadsDir();
        try {
            await fs.mkdir(uploadsDir, { recursive: true });
            await fs.mkdir(path.join(uploadsDir, 'thumbnails'), { recursive: true });
            await fs.mkdir(path.join(uploadsDir, 'medium'), { recursive: true });
            await fs.mkdir(path.join(uploadsDir, 'large'), { recursive: true });
        } catch (err) {
            logger.error('Failed to create local upload directories', err);
        }
    }

    async save(buffer, filename, folder = '') {
        const filePath = path.join(this.getUploadsDir(), folder, filename);
        await fs.writeFile(filePath, buffer);
        return `/uploads/${folder ? folder + '/' : ''}${filename}`;
    }

    async delete(filename, folder = '') {
        const filePath = path.join(this.getUploadsDir(), folder, filename);
        try {
            await fs.access(filePath);
            await fs.unlink(filePath);
        } catch (e) {
            if (e.code !== 'ENOENT') {
                logger.warn(`Failed to delete local file: ${filePath}`, { error: e.message });
            }
        }
    }
}

module.exports = new LocalStorage();
