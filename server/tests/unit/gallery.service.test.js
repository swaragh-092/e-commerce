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
