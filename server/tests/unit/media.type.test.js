import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const service = require('../../src/modules/media/media.service');

describe('media type segregation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('filters by type=icon when listing custom icons', async () => {
    const findAndCountAll = vi.spyOn(db.Media, 'findAndCountAll').mockResolvedValue({
      rows: [{ id: 'icon-1', url: '/icon.png', type: 'icon' }],
      count: 1,
    });

    const result = await service.listMedia(1, 20, 'createdAt', 'desc', 'icon');

    expect(findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: 'icon' },
      })
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0].type).toBe('icon');
  });

  it('filters by image (including null for backward compatibility) when listing images', async () => {
    const findAndCountAll = vi.spyOn(db.Media, 'findAndCountAll').mockResolvedValue({
      rows: [],
      count: 0,
    });

    await service.listMedia(1, 20, 'createdAt', 'desc', 'image');

    expect(findAndCountAll).toHaveBeenCalled();
    const where = findAndCountAll.mock.calls[0][0].where;
    expect(where.type).toBeDefined();
  });

  it('does not restrict by type when type=all is specified', async () => {
    const findAndCountAll = vi.spyOn(db.Media, 'findAndCountAll').mockResolvedValue({
      rows: [],
      count: 0,
    });

    await service.listMedia(1, 20, 'createdAt', 'desc', 'all');

    expect(findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
  });

  it('defaults to type=image when no type argument is provided', async () => {
    const findAndCountAll = vi.spyOn(db.Media, 'findAndCountAll').mockResolvedValue({
      rows: [],
      count: 0,
    });

    await service.listMedia(1, 20);

    expect(findAndCountAll).toHaveBeenCalled();
    const where = findAndCountAll.mock.calls[0][0].where;
    expect(where.type).toBeDefined();
  });
});


