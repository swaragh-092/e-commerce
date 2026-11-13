import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const { Media } = require('../../src/modules');
const service = require('../../src/modules/media/media.service');
const storage = require('../../src/utils/storage').getStorageProvider();
const sharp = require('sharp');

let file;
let transaction;
let stored;
beforeEach(async () => {
  const buffer = await sharp({ create: { width: 32, height: 24, channels: 4, background: '#ff0000' } }).png().toBuffer();
  file = { buffer, size: buffer.length, originalname: 'renamed.png' };
  transaction = { id: 'transaction' };
  vi.spyOn(Media.sequelize, 'transaction').mockImplementation((callback) => callback(transaction));
  vi.spyOn(Media.sequelize, 'query').mockResolvedValue([]);
  vi.spyOn(Media, 'findOne').mockResolvedValue(null);
  vi.spyOn(Media, 'findAll').mockResolvedValue([]);
  vi.spyOn(Media, 'create').mockImplementation(async (data) => ({ id: 'new-media', ...data }));
  stored = vi.spyOn(storage, 'save').mockResolvedValue('/uploads/new.png');
  vi.spyOn(storage, 'read');
});
afterEach(() => vi.restoreAllMocks());

describe('exact duplicate media detection', () => {
  it('warns for matching contents even with a different filename, before writing files', async () => {
    Media.findOne.mockResolvedValue({ id: 'existing', originalName: 'original.png', url: '/uploads/existing.png' });
    await expect(service.uploadMedia(file)).rejects.toMatchObject({ code: 'DUPLICATE_MEDIA', statusCode: 409,
      details: { media: { id: 'existing', originalName: 'original.png' } } });
    expect(stored).not.toHaveBeenCalled();
    expect(Media.create).not.toHaveBeenCalled();
    expect(Media.findOne.mock.calls[0][0].where.contentHash).toBe(createHash('sha256').update(file.buffer).digest('hex'));
  });
  it('permits an explicit additional copy and stores the fingerprint', async () => {
    const result = await service.uploadMedia(file, 'image', { allowDuplicate: true, uploadedBy: 'user-1' });
    expect(result.contentHash).toBe(createHash('sha256').update(file.buffer).digest('hex'));
    expect(Media.findOne).not.toHaveBeenCalled();
    expect(stored).toHaveBeenCalledTimes(4);
    expect(Media.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'image', uploadedBy: 'user-1' }), { transaction });
  });
  it('matches older files by bytes and caches the fingerprint', async () => {
    const update = vi.fn().mockResolvedValue({});
    Media.findAll.mockResolvedValue([{ id: 'legacy', filename: 'legacy.png', provider: 'local', update }]);
    storage.read.mockResolvedValue(file.buffer);
    await expect(service.uploadMedia(file)).rejects.toMatchObject({ code: 'DUPLICATE_MEDIA', details: { media: { id: 'legacy' } } });
    expect(update).toHaveBeenCalledWith({ contentHash: createHash('sha256').update(file.buffer).digest('hex') }, { transaction });
    expect(stored).not.toHaveBeenCalled();
  });
  it('allows the same name with different bytes and ignores missing legacy files', async () => {
    Media.findAll.mockResolvedValue([{ filename: 'missing.png', provider: 'local' }]);
    storage.read.mockRejectedValue(Object.assign(new Error('Missing'), { code: 'ENOENT' }));
    await expect(service.uploadMedia(file)).resolves.toMatchObject({ id: 'new-media' });
  });
  it('uses a transaction-scoped database lock before duplicate lookup', async () => {
    await service.uploadMedia(file, 'icon');
    expect(Media.sequelize.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(CAST(:key AS bigint))', {
      replacements: { key: expect.stringMatching(/^-?\d+$/) }, transaction,
    });
    expect(Media.sequelize.query.mock.invocationCallOrder[0]).toBeLessThan(Media.findOne.mock.invocationCallOrder[0]);
    expect(Media.findOne.mock.calls[0][0].where.type).toBe('icon');
  });
  it('rejects unknown binary contents before taking a database lock', async () => {
    await expect(service.uploadMedia({ ...file, buffer: Buffer.from('not an image') })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(Media.sequelize.query).not.toHaveBeenCalled();
  });
});
