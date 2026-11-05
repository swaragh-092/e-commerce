import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const { CropPreset } = require('../../src/modules');
const service = require('../../src/modules/media/cropPreset.service');
const { cropPresetSchema } = require('../../src/modules/media/media.validation');
const tx = { id: 'transaction' };
const row = (extra = {}) => ({ id: 'preset-id', name: 'Social portrait', width: 1080, height: 1350, ...extra });
beforeEach(() => {
  vi.spyOn(CropPreset.sequelize, 'transaction').mockImplementation(callback => callback(tx));
  vi.spyOn(CropPreset.sequelize, 'query').mockResolvedValue([]);
  vi.spyOn(CropPreset, 'count').mockResolvedValue(0);
  vi.spyOn(CropPreset, 'create').mockImplementation(async values => row(values));
  vi.spyOn(CropPreset, 'findAll').mockResolvedValue([row()]);
  vi.spyOn(CropPreset, 'findByPk').mockResolvedValue(null);
});
afterEach(() => vi.restoreAllMocks());
describe('store-wide crop presets', () => {
  it('persists normalized unique names and returns a reusable ratio', async () => {
    const result = await service.create({ name: ' Social portrait ', width: 1080, height: 1350 });
    expect(CropPreset.create).toHaveBeenCalledWith({ name: 'Social portrait', normalizedName: 'social portrait', width: 1080, height: 1350 }, { transaction: tx });
    expect(result).toMatchObject({ id: 'custom:preset-id', recordId: 'preset-id', label: 'Social portrait', ratio: 0.8, custom: true });
    expect(CropPreset.sequelize.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(583106551)', { transaction: tx });
  });
  it('rejects a duplicate name without hiding the reason', async () => {
    CropPreset.create.mockRejectedValue(Object.assign(new Error('duplicate'), { name: 'SequelizeUniqueConstraintError' }));
    await expect(service.create({ name: 'Social portrait', width: 1080, height: 1350 })).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 });
  });
  it('limits active presets to 50', async () => {
    CropPreset.count.mockResolvedValue(50);
    await expect(service.create({ name: 'Overflow', width: 100, height: 100 })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(CropPreset.create).not.toHaveBeenCalled();
  });
  it('lists active presets in stable name order with a bounded result', async () => {
    expect(await service.list()).toHaveLength(1);
    expect(CropPreset.findAll).toHaveBeenCalledWith({ order: [['name', 'ASC']], limit: 50 });
  });
  it('updates a preset without modifying media records', async () => {
    const preset = row({ update: vi.fn(async function (values) { Object.assign(this, values); }) });
    CropPreset.findByPk.mockResolvedValue(preset);
    expect(await service.update('preset-id', { name: 'Tall banner', width: 900, height: 1200 })).toMatchObject({ label: 'Tall banner', ratio: 0.75 });
    expect(preset.update).toHaveBeenCalledWith({ name: 'Tall banner', normalizedName: 'tall banner', width: 900, height: 1200 }, { transaction: tx });
  });
  it('soft-deletes and restores presets through the same serialized mutation path', async () => {
    const preset = row({ destroy: vi.fn(), deletedAt: new Date(), restore: vi.fn() });
    CropPreset.findByPk.mockResolvedValue(preset);
    await service.remove('preset-id');
    expect(preset.destroy).toHaveBeenCalledWith({ transaction: tx });
    await service.restore('preset-id');
    expect(CropPreset.findByPk).toHaveBeenLastCalledWith('preset-id', { paranoid: false, transaction: tx });
    expect(preset.restore).toHaveBeenCalledWith({ transaction: tx });
  });
  it('returns a useful error for a preset another admin has removed', async () => {
    await expect(service.update('missing', { name: 'Missing', width: 100, height: 100 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
describe('preset input validation', () => {
  it.each([
    { name: '', width: 100, height: 100 },
    { name: '   ', width: 100, height: 100 },
    { name: 'Invalid', width: 0, height: 100 },
    { name: 'Invalid', width: 4097, height: 100 },
    { name: 'Invalid', width: 100, height: 3.5 },
    { name: 'Invalid', width: 100 },
    { name: 'x'.repeat(61), width: 100, height: 100 },
  ])('rejects invalid preset input %#', data => expect(cropPresetSchema.validate(data).error).toBeDefined());
  it('accepts trimmed names and bounded whole dimensions', () => {
    expect(cropPresetSchema.validate({ name: ' Banner ', width: 1920, height: 640 }).value).toEqual({ name: 'Banner', width: 1920, height: 640 });
  });
});
