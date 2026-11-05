'use strict';
const path = require('path');
const fs = require('fs').promises;
const logger = require('../logger');
const { randomUUID } = require('node:crypto');

const SERVER_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_UPLOADS_DIR = path.resolve(SERVER_ROOT, 'uploads');

class LocalStorage {
    getUploadsDir() {
        if (!process.env.UPLOAD_DIR) {
            return DEFAULT_UPLOADS_DIR;
        }

        return path.isAbsolute(process.env.UPLOAD_DIR)
            ? process.env.UPLOAD_DIR
            : path.resolve(SERVER_ROOT, process.env.UPLOAD_DIR);
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

    async read(filename) {
        // Read only generated filenames, never a caller-supplied path.
        if (!filename || path.basename(filename) !== filename) {
            throw new Error('Invalid storage filename');
        }
        return fs.readFile(path.join(this.getUploadsDir(), filename));
    }

    checkedFilename(filename) {
        if (!filename || path.basename(filename) !== filename || filename.startsWith('.')) throw new Error('Invalid storage filename');
        return filename;
    }

    async retainOriginal(filename, buffer) {
        this.checkedFilename(filename);
        const folder = path.join(this.getUploadsDir(), '.originals');
        await fs.mkdir(folder, { recursive: true, mode: 0o700 });
        const temporary = path.join(folder, `.${randomUUID()}.tmp`);
        try {
            const handle = await fs.open(temporary, 'wx', 0o600);
            try { await handle.writeFile(buffer); await handle.sync(); } finally { await handle.close(); }
            // Publish only a complete backup, without ever replacing the first original.
            try { await fs.link(temporary, path.join(folder, filename)); }
            catch (error) { if (error.code !== 'EEXIST') throw error; }
        } finally { await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    }

    async readOriginal(filename) {
        return fs.readFile(path.join(this.getUploadsDir(), '.originals', this.checkedFilename(filename)));
    }

    async saveAtomic(buffer, filename, folder = '') {
        this.checkedFilename(filename);
        if (!['', 'thumbnails', 'medium', 'large'].includes(folder)) throw new Error('Invalid storage folder');
        const target = path.join(this.getUploadsDir(), folder, filename);
        const temporary = path.join(path.dirname(target), `.${randomUUID()}.tmp`);
        try { await fs.writeFile(temporary, buffer); await fs.rename(temporary, target); }
        finally { await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
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
