import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = require('../../src/modules');
const service = require('../../src/modules/gallery/gallery.service');

describe('showcase galleries', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));
  });

  it('lists only active showcase albums for visitors', async () => {
    const findAll = vi.spyOn(db.Gallery, 'findAll').mockResolvedValue([]);
    await service.listPublic();
    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true, isShowcase: true } }));
  });

  it('uses the selected cover, otherwise the first ordered image, and handles empty albums', async () => {
    const first = { id: 'first', url: '/first.png' };
    const custom = { id: 'cover', url: '/cover.png' };
    vi.spyOn(db.Gallery, 'findAll').mockResolvedValue([
      { toJSON: () => ({ id: 'a', title: 'A', coverImage: custom, items: [{ media: first }] }) },
      { toJSON: () => ({ id: 'b', title: 'B', coverImage: null, items: [{ media: first }] }) },
      { toJSON: () => ({ id: 'c', title: 'C', coverImage: null, items: [] }) },
    ]);
    const result = await service.listPublic();
    expect(result.map((album) => album.coverImage)).toEqual([custom, first, null]);
    expect(result[0]).not.toHaveProperty('items');
    const query = db.Gallery.findAll.mock.calls[0][0];
    expect(query.include.find((include) => include.as === 'items')).toMatchObject({ limit: 1, separate: true, order: [['priority', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']] });
  });

  it('rejects a missing or non-image cover before creating a gallery', async () => {
    vi.spyOn(db.Gallery, 'findOne').mockResolvedValue(null);
    vi.spyOn(db.Media, 'findByPk').mockResolvedValue(null);
    const create = vi.spyOn(db.Gallery, 'create');
    await expect(service.createGallery({ title: 'A', slug: 'a', coverMediaId: 'missing' })).rejects.toThrow('Cover photo must be an existing image');
    db.Media.findByPk.mockResolvedValue({ mimeType: 'application/pdf' });
    await expect(service.createGallery({ title: 'A', slug: 'a', coverMediaId: 'document' })).rejects.toThrow('Cover photo must be an existing image');
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a gallery with an image cover and allows clearing it', async () => {
    vi.spyOn(db.Gallery, 'findOne').mockResolvedValue(null);
    vi.spyOn(db.Media, 'findByPk').mockResolvedValue({ mimeType: 'image/png' });
    const create = vi.spyOn(db.Gallery, 'create').mockResolvedValue({ id: 'album' });
    await service.createGallery({ title: 'A', slug: 'a', coverMediaId: 'cover' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ coverMediaId: 'cover', isShowcase: true }));
    const update = vi.fn().mockResolvedValue({});
    db.Gallery.findOne.mockResolvedValue({ id: 'album', update });
    vi.spyOn(db.Gallery, 'findByPk').mockResolvedValue({ id: 'album', coverMediaId: null });
    await service.updateGallery('album', { coverMediaId: null });
    expect(update).toHaveBeenCalledWith({ coverMediaId: null });
  });

  it('adds only new images and keeps existing gallery order', async () => {
    vi.spyOn(db.Gallery, 'findOne').mockResolvedValue({ id: 'album' });
    vi.spyOn(db.Gallery, 'findByPk').mockResolvedValue({ id: 'album', items: [] });
    vi.spyOn(db.Media, 'findAll').mockResolvedValue([
      { id: 'old', mimeType: 'image/jpeg' }, { id: 'new', mimeType: 'image/png' },
    ]);
    vi.spyOn(db.GalleryItem, 'findAll').mockResolvedValue([{ mediaId: 'old', priority: 4 }]);
    const create = vi.spyOn(db.GalleryItem, 'create').mockResolvedValue({});
    await service.addItems('album', ['old', 'new']);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ galleryId: 'album', mediaId: 'new', priority: 5 }, expect.anything());
  });

  it('rejects files that are missing or are not images without adding anything', async () => {
    vi.spyOn(db.Gallery, 'findOne').mockResolvedValue({ id: 'album' });
    vi.spyOn(db.Media, 'findAll').mockResolvedValue([{ id: 'document', mimeType: 'application/pdf' }]);
    const create = vi.spyOn(db.GalleryItem, 'create');
    await expect(service.addItems('album', ['document'])).rejects.toThrow('Gallery items must be existing images');
    await expect(service.addItems('album', ['document', 'missing'])).rejects.toThrow('Gallery items must be existing images');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects repeated item ids while reordering', async () => {
    vi.spyOn(db.Gallery, 'findOne').mockResolvedValue({ id: 'album' });
    vi.spyOn(db.GalleryItem, 'findAll').mockResolvedValue([{ id: 'one' }, { id: 'two' }]);
    const update = vi.spyOn(db.GalleryItem, 'update');
    await expect(service.reorderItems('album', ['one', 'one'])).rejects.toThrow('itemIds must contain all gallery item ids exactly once');
    expect(update).not.toHaveBeenCalled();
  });
});


describe('gallery cover request validation', () => {
  const { createGallerySchema, updateGallerySchema } = require('../../src/modules/gallery/gallery.validation');
  const coverMediaId = '5f4dcc3b-5aa7-4d6a-bdb6-46fd5e7edaa1';
  it('accepts optional image references and explicit removal', () => {
    expect(createGallerySchema.validate({ title: 'Flowers', slug: 'flowers', coverMediaId }).error).toBeUndefined();
    expect(updateGallerySchema.validate({ coverMediaId }).error).toBeUndefined();
    expect(updateGallerySchema.validate({ coverMediaId: null }).error).toBeUndefined();
    expect(updateGallerySchema.validate({ coverMediaId: 'not-an-id' }).error).toBeDefined();
  });
});
