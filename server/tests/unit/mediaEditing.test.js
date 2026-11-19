import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const { Media } = require('../../src/modules');
const storage = require('../../src/utils/storage').getStorageProvider();
const service = require('../../src/modules/media/mediaEditing.service');
let directory, original, edited, media, transaction;
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'media-edit-'));
  vi.spyOn(storage, 'getUploadsDir').mockReturnValue(directory);
  await storage.ensureDirs();
  original = await sharp({ create: { width: 32, height: 24, channels: 4, background: '#ff0000' } }).png().toBuffer();
  edited = await sharp({ create: { width: 12, height: 12, channels: 4, background: '#00ff00' } }).webp().toBuffer();
  await storage.save(original, 'image.png');
  media = { id: 'same-id', url: '/uploads/image.png', filename: 'image.png', originalName: 'Product.png', mimeType: 'image/png', provider: 'local', update: vi.fn(async values => Object.assign(media, values)) };
  transaction = { LOCK: { UPDATE: 'UPDATE' }, commit: vi.fn(), rollback: vi.fn() };
  vi.spyOn(Media.sequelize, 'transaction').mockResolvedValue(transaction);
  vi.spyOn(Media, 'findByPk').mockResolvedValue(media);
});
afterEach(async () => { vi.restoreAllMocks(); await rm(directory, { recursive: true, force: true }); });
describe('editing existing media', () => {
  it('keeps identity, filename and format, and regenerates all image sizes', async () => {
    const result = await service.replace(media.id, { buffer: edited });
    expect(result).toMatchObject({ id: 'same-id', url: '/uploads/image.png', originalName: 'Product.png', mimeType: 'image/png', isEdited: true });
    expect(await storage.readOriginal('image.png')).toEqual(original);
    expect(await sharp(await storage.read('image.png')).metadata()).toMatchObject({ width: 12, height: 12, format: 'png' });
    for (const folder of ['thumbnails', 'medium', 'large']) expect(await sharp(await readFile(path.join(directory, folder, 'image.webp'))).metadata()).toMatchObject({ width: 12, height: 12 });
    expect(Media.findByPk).toHaveBeenCalledWith('same-id', { transaction, lock: 'UPDATE' });
    expect(transaction.commit).toHaveBeenCalledOnce();
  });
  it('retains the first original through repeated edits and restores its exact bytes', async () => {
    await service.replace(media.id, { buffer: edited });
    await service.replace(media.id, { buffer: edited });
    await service.revert(media.id);
    expect(await storage.read('image.png')).toEqual(original);
    expect(await storage.readOriginal('image.png')).toEqual(original);
    expect(media.isEdited).toBe(false);
  });
  it('restores public bytes if the database update fails', async () => {
    media.update.mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(service.replace(media.id, { buffer: edited })).rejects.toThrow('Database unavailable');
    expect(await storage.read('image.png')).toEqual(original);
    expect(await storage.readOriginal('image.png')).toEqual(original);
    expect(transaction.rollback).toHaveBeenCalledOnce();
  });
  it('rejects invalid data before changing any public file', async () => {
    await expect(service.replace(media.id, { buffer: Buffer.from('invalid') })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await storage.read('image.png')).toEqual(original);
    expect(media.update).not.toHaveBeenCalled();
  });
  it('returns a recoverable error if no original exists', async () => {
    await expect(service.revert(media.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await storage.read('image.png')).toEqual(original);
  });
});
