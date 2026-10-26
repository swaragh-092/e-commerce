import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { validateUnitCatalogSetting, ensureUnitCatalogChangesAllowed, getUnitUsage, ensureUnitCategoriesAllowed } = require('../../src/modules/settings/unitCatalog');
const { sequelize, Setting } = require('../../src/modules');
const SettingsService = require('../../src/modules/settings/settings.service');
const AuditService = require('../../src/modules/audit/audit.service');
const unit = { value: 'm³', label: 'Cubic metre', category: 'Volume', enabled: true };
const standardUnits = require('../../../shared/units.json');
const defaultCategories = [...new Set(standardUnits.map((unit) => unit.category))];

beforeEach(() => {
  vi.spyOn(sequelize, 'query').mockResolvedValue([]);
  vi.spyOn(Setting, 'findAll').mockResolvedValue([]);
});

afterEach(() => vi.restoreAllMocks());

describe('unit catalog settings validation', () => {
  it('accepts custom Unicode symbols and hidden units', () => {
    expect(() => validateUnitCatalogSetting('unitCatalog', [unit, { ...unit, value: 'cm', enabled: false }], 'catalog')).not.toThrow();
    expect(() => validateUnitCatalogSetting('unrelated', 'unchanged', 'general')).not.toThrow();
  });

  it.each([
    undefined, null, {}, [null], [{ ...unit, value: '' }], [{ ...unit, value: 'x'.repeat(21) }],
    [{ ...unit, label: 'x'.repeat(81) }], [{ ...unit, category: ' ' }], [{ ...unit, category: 'x'.repeat(51) }],
    [{ ...unit, enabled: 'false' }], [{ ...unit, value: 'bad\nunit' }], [unit, { ...unit, value: 'M³' }],
    [{ ...unit, enabled: true, deleted: true }],
    Array.from({ length: 301 }, (_, i) => ({ ...unit, value: `u${i}` })),
  ])('rejects invalid or duplicate unit definitions before persistence (%#)', (value) => {
    expect(() => validateUnitCatalogSetting('unitCatalog', value, 'catalog')).toThrow();
  });

  it('protects single and bulk settings writes', async () => {
    const transaction = vi.spyOn(sequelize, 'transaction');
    await expect(SettingsService.updateKey('unitCatalog', [{ ...unit, value: 'long'.repeat(6) }], 'catalog', 'admin')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(SettingsService.bulkUpdate([{ key: 'unitCatalog', group: 'catalog', value: [unit, unit] }], 'admin')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(SettingsService.updateKey('unitCatalog', [unit], 'general', 'admin')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('stores validated definitions through the existing settings transaction', async () => {
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback) => callback({}));
    vi.spyOn(Setting, 'findOne').mockResolvedValue(null);
    const create = vi.spyOn(Setting, 'create').mockImplementation(async (data) => ({ ...data, toJSON: () => data }));
    vi.spyOn(AuditService, 'log').mockResolvedValue(undefined);
    await SettingsService.updateKey('unitCatalog', [unit], 'catalog', 'admin');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ group: 'catalog', key: 'unitCatalog', value: [unit], updatedBy: 'admin' }), expect.anything());
  });
});

describe('managed unit categories', () => {
  it.each([
    null, {}, [''], [' '], [' Length'], ['Length  group'], ['Length', 'length'],
    ['All units'], ['All categories'], ['Existing unit'], ['x'.repeat(51)], ['Bad\nname'],
    Array.from({ length: 101 }, (_, i) => `Category ${i}`),
  ])('rejects invalid category names and duplicates (%#)', (value) => {
    expect(() => validateUnitCatalogSetting('unitCategories', value, 'catalog')).toThrow();
  });

  it('accepts valid categories, including an empty list for an empty catalog', () => {
    expect(() => validateUnitCatalogSetting('unitCategories', ['Length', 'Surface area', '温度'], 'catalog')).not.toThrow();
    expect(() => validateUnitCatalogSetting('unitCategories', [], 'catalog')).not.toThrow();
  });

  it('stores empty categories independently from units', async () => {
    await expect(ensureUnitCategoriesAllowed([{ group: 'catalog', key: 'unitCategories', value: [...defaultCategories, 'Temperature'] }], {})).resolves.toBeUndefined();
  });

  it('blocks renaming or removing a populated category without moving its units', async () => {
    await expect(ensureUnitCategoriesAllowed([{ group: 'catalog', key: 'unitCategories', value: defaultCategories.filter((name) => name !== 'Weight') }], {})).rejects.toMatchObject({ code: 'UNIT_CATEGORY_IN_USE' });
  });

  it('checks hidden units in the current stored catalog before deleting a category', async () => {
    Setting.findAll.mockResolvedValue([
      { key: 'unitCategories', value: [...defaultCategories, 'Temperature'] },
      { key: 'unitCatalog', value: [{ value: '°C', label: 'Celsius', category: 'Temperature', enabled: false }] },
    ]);
    await expect(ensureUnitCategoriesAllowed([
      { group: 'catalog', key: 'unitCategories', value: defaultCategories },
    ], {})).rejects.toMatchObject({ code: 'UNIT_CATEGORY_IN_USE', message: expect.stringContaining('Only empty categories can be deleted.') });
  });

  it('allows deleting an empty category without modifying the catalog', async () => {
    Setting.findAll.mockResolvedValue([{ key: 'unitCategories', value: [...defaultCategories, 'Temperature'] }]);
    await expect(ensureUnitCategoriesAllowed([
      { group: 'catalog', key: 'unitCategories', value: defaultCategories },
    ], {})).resolves.toBeUndefined();
  });

  it('does not count deleted units as category contents', async () => {
    const catalog = standardUnits.map((unit) => ({ ...unit, enabled: false, deleted: unit.category === 'Length' }));
    Setting.findAll.mockResolvedValue([
      { key: 'unitCategories', value: defaultCategories },
      { key: 'unitCatalog', value: catalog },
    ]);
    await expect(ensureUnitCategoriesAllowed([
      { group: 'catalog', key: 'unitCategories', value: defaultCategories.filter((name) => name !== 'Length') },
    ], {})).resolves.toBeUndefined();
  });

  it('allows a category rename when all unit assignments change atomically', async () => {
    const moved = standardUnits.map((unit) => ({ ...unit, category: unit.category === 'Weight' ? 'Mass' : unit.category, enabled: unit.value !== 'kg' }));
    await expect(ensureUnitCategoriesAllowed([
      { group: 'catalog', key: 'unitCategories', value: defaultCategories.map((name) => name === 'Weight' ? 'Mass' : name) },
      { group: 'catalog', key: 'unitCatalog', value: moved },
    ], {})).resolves.toBeUndefined();
  });

  it('keeps attribute category references in sync when a category is renamed', async () => {
    const catalog = standardUnits.map((unit) => ({ ...unit, category: unit.category === 'Length' ? 'Dimensions' : unit.category, enabled: true }));
    await ensureUnitCategoriesAllowed([
      { group: 'catalog', key: 'unitCategories', value: defaultCategories.map((name) => name === 'Length' ? 'Dimensions' : name) },
      { group: 'catalog', key: 'unitCatalog', value: catalog },
    ], { id: 'tx' });
    expect(sequelize.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE attribute_templates SET unit_category'), expect.objectContaining({ replacements: { previous: 'Length', next: 'Dimensions' }, transaction: { id: 'tx' } }));
  });

  it('blocks empty-category deletion while an attribute still references it', async () => {
    Setting.findAll.mockResolvedValue([{ key: 'unitCategories', value: [...defaultCategories, 'Temperature'] }]);
    sequelize.query.mockImplementation(async (sql) => sql.startsWith('SELECT unit_category') ? [{ unit_category: 'Temperature' }] : []);
    await expect(ensureUnitCategoriesAllowed([
      { group: 'catalog', key: 'unitCategories', value: defaultCategories },
    ], {})).rejects.toMatchObject({ code: 'UNIT_CATEGORY_IN_USE', message: expect.stringContaining('assigned to an attribute') });
  });

  it('blocks units from being assigned to an unregistered category', async () => {
    Setting.findAll.mockResolvedValue([{ key: 'unitCategories', value: defaultCategories }]);
    await expect(ensureUnitCategoriesAllowed([{ group: 'catalog', key: 'unitCatalog', value: [{ ...unit, category: 'Unknown' }] }], {})).rejects.toMatchObject({ code: 'UNIT_CATEGORY_IN_USE' });
  });

  it('requires registration of new categories even before the first category list is saved', async () => {
    await expect(ensureUnitCategoriesAllowed([{ group: 'catalog', key: 'unitCatalog', value: [{ ...unit, category: 'Unknown' }] }], {})).rejects.toMatchObject({ code: 'UNIT_CATEGORY_IN_USE' });
  });

  it('allows empty catalogs after every built-in definition has been removed', async () => {
    await expect(ensureUnitCategoriesAllowed([
      { group: 'catalog', key: 'unitCategories', value: [] },
      { group: 'catalog', key: 'unitCatalog', value: standardUnits.map((unit) => ({ ...unit, enabled: false, deleted: true })) },
    ], {})).resolves.toBeUndefined();
  });

  it('checks final category assignments before either single or bulk writes', async () => {
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback) => callback({}));
    const findOne = vi.spyOn(Setting, 'findOne');
    await expect(SettingsService.updateKey('unitCategories', [], 'catalog', 'admin')).rejects.toMatchObject({ code: 'UNIT_CATEGORY_IN_USE' });
    await expect(SettingsService.bulkUpdate([{ key: 'unitCategories', group: 'catalog', value: [] }], 'admin')).rejects.toMatchObject({ code: 'UNIT_CATEGORY_IN_USE' });
    expect(findOne).not.toHaveBeenCalled();
  });
});

describe('unit deletion safety', () => {
  const removedCm = { value: 'cm', label: 'Centimetre (cm)', category: 'Length', enabled: false, deleted: true };
  const mockQueries = (rows) => vi.spyOn(sequelize, 'query').mockImplementation(async (sql) => sql.startsWith('LOCK TABLE') ? undefined : rows);

  it.each(['products', 'attributes', 'values'])('blocks deletion when referenced by %s', async (source) => {
    const query = mockQueries([{ unit: ' CM ', source, count: 1 }]);
    await expect(ensureUnitCatalogChangesAllowed('unitCatalog', [removedCm], [], { id: 'transaction' })).rejects.toMatchObject({ code: 'UNIT_IN_USE', statusCode: 409 });
    expect(query.mock.calls[0][0]).toContain('LOCK TABLE products, attribute_templates, attribute_values IN SHARE MODE');
    expect(query.mock.calls[1][1]).toMatchObject({ transaction: { id: 'transaction' } });
  });

  it('allows deletion when no references exist', async () => {
    mockQueries([]);
    await expect(ensureUnitCatalogChangesAllowed('unitCatalog', [removedCm], [], {})).resolves.toBeUndefined();
  });

  it('guards custom-unit deletion by omission, including legacy display labels', async () => {
    mockQueries([{ unit: 'cubic metre', source: 'products', count: 2 }]);
    await expect(ensureUnitCatalogChangesAllowed('unitCatalog', [], [unit], {})).rejects.toMatchObject({ code: 'UNIT_IN_USE', details: { products: 2, total: 2 } });
  });

  it('does not treat hiding or renaming a unit as deletion', async () => {
    const query = mockQueries([]);
    await expect(ensureUnitCatalogChangesAllowed('unitCatalog', [{ ...unit, enabled: false, label: 'Custom volume' }], [unit], {})).resolves.toBeUndefined();
    expect(query).not.toHaveBeenCalled();
  });

  it('preserves the original standard label as an alias after customization', async () => {
    mockQueries([{ unit: 'centimetre (cm)', source: 'products', count: 1 }]);
    await expect(ensureUnitCatalogChangesAllowed('unitCatalog', [removedCm], [{ ...removedCm, label: 'Custom name', enabled: true, deleted: false }], {})).rejects.toMatchObject({ code: 'UNIT_IN_USE' });
  });

  it('protects generic single and bulk settings APIs before modifying the catalog', async () => {
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback) => callback({}));
    const update = vi.fn();
    vi.spyOn(Setting, 'findOne').mockResolvedValue({ value: [], toJSON: () => ({}), update });
    mockQueries([{ unit: 'cm', source: 'values', count: 1 }]);
    await expect(SettingsService.updateKey('unitCatalog', [removedCm], 'catalog', 'admin')).rejects.toMatchObject({ code: 'UNIT_IN_USE' });
    await expect(SettingsService.bulkUpdate([{ key: 'unitCatalog', group: 'catalog', value: [removedCm] }], 'admin')).rejects.toMatchObject({ code: 'UNIT_IN_USE' });
    expect(update).not.toHaveBeenCalled();
  });

  it('returns grouped usage counts without exposing product records', async () => {
    vi.spyOn(Setting, 'findOne').mockResolvedValue({ value: [unit] });
    mockQueries([{ unit: 'm³', source: 'products', count: 2 }, { unit: 'M³', source: 'values', count: 1 }]);
    const usage = await getUnitUsage();
    expect(usage['m³']).toEqual({ products: 2, attributes: 0, values: 1, total: 3 });
    expect(usage.cm.total).toBe(0);
  });
});
