import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const apiBuilder = require('../../src/modules/apiBuilder/apiBuilder.service');
const SettingsService = require('../../src/modules/settings/settings.service');

const { Product, Setting, Sequelize } = db;

beforeEach(() => {
  vi.spyOn(SettingsService, 'getFeatures').mockResolvedValue({ features: {} });
});

afterEach(() => vi.restoreAllMocks());

describe('API Builder public data boundaries', () => {
  it('rejects private settings groups', async () => {
    await expect(apiBuilder.executeConfig({
      includeMeta: false,
      blocks: [{ key: 'settings', resource: 'settings', group: 'admin' }],
    })).rejects.toMatchObject({
      statusCode: 400,
      message: 'This settings group cannot be exposed through API Builder',
    });
  });



  it('filters privileged settings out of public settings lists', async () => {
    vi.spyOn(Setting, 'findAll').mockResolvedValue([
      { group: 'general', key: 'storeName', value: 'Shop' },
      { group: 'admin', key: 'dashboard', value: { secret: true } },
      { group: 'gateway_credentials', key: 'stripe', value: { secretKey: 'secret' } },
      { group: 'advanced', key: 'customCSS', value: 'body{}' },
      { group: 'advanced', key: 'internalFlag', value: true },
    ]);

    const result = await apiBuilder.executeConfig({
      includeMeta: false,
      blocks: [{ key: 'settings', resource: 'settings' }],
    });

    expect(result.settings).toHaveLength(2);
    expect(result.settings).toEqual(expect.arrayContaining([
      { key: 'customCSS', value: 'body{}', group: 'advanced' },
      { key: 'storeName', value: 'Shop', group: 'general' },
    ]));
  });

  it('filters advanced settings groups down to storefront-safe keys', async () => {
    vi.spyOn(Setting, 'findAll').mockResolvedValue([
      { group: 'advanced', key: 'customCSS', value: 'body{}' },
      { group: 'advanced', key: 'headScripts', value: '<script></script>' },
      { group: 'advanced', key: 'internalFlag', value: true },
    ]);

    const result = await apiBuilder.executeConfig({
      includeMeta: false,
      blocks: [{ key: 'settings', resource: 'settings', group: 'advanced' }],
    });

    expect(result.settings).toEqual({
      customCSS: 'body{}',
      headScripts: '<script></script>',
      bodyScripts: '',
    });
  });

  it('cannot override product publication filters through API configuration', async () => {
    const findAll = vi.spyOn(Product, 'findAll').mockResolvedValue([]);

    await apiBuilder.executeConfig({
      includeMeta: false,
      blocks: [{
        key: 'products',
        resource: 'products',
        filters: [{ field: 'type', operator: 'eq', value: 'combo' }],
      }],
    });

    const where = findAll.mock.calls[0][0].where;
    expect(where[Sequelize.Op.and]).toEqual([
      { type: 'combo' },
      { status: 'published', isEnabled: true },
    ]);
  });
});
