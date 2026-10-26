'use strict';

const Joi = require('joi');
const AppError = require('../../utils/AppError');
const standardUnits = require('../../../../shared/units.json');

const text = (max) => Joi.string().trim().max(max).pattern(/^[^\u0000-\u001f\u007f]+$/).required();
const unitCatalogSchema = Joi.array().max(400).required().items(Joi.object({
  value: text(20),
  label: text(80),
  category: text(50),
  enabled: Joi.boolean().required(),
  deleted: Joi.boolean().optional(),
}).unknown(false));
const categorySchema = Joi.array().max(100).required().items(text(50).optional());
const normalizeCategory = (name) => String(name || '').trim().replace(/\s+/g, ' ');
const reservedCategories = new Set(['all units', 'all categories', 'existing unit']);

const validateUnitCatalogSetting = (key, value, group) => {
  if (!['unitCatalog', 'unitCategories'].includes(key)) return;
  if (group !== 'catalog') throw new AppError('VALIDATION_ERROR', 400, 'Unit settings must use the catalog group.');
  if (key === 'unitCategories') {
    const { error } = categorySchema.validate(value, { convert: false });
    if (error) throw new AppError('VALIDATION_ERROR', 400, `Invalid unit categories: ${error.details[0].message}`);
    const names = new Set();
    for (const name of value) {
      const normalized = normalizeCategory(name);
      if (name !== normalized) throw new AppError('VALIDATION_ERROR', 400, 'Category names must use single spaces with no surrounding whitespace.');
      const key = normalized.toLowerCase();
      if (reservedCategories.has(key)) throw new AppError('VALIDATION_ERROR', 400, 'Choose a category name other than All units, All categories, or Existing unit.');
      if (names.has(key)) throw new AppError('VALIDATION_ERROR', 400, 'Category names must be unique (ignoring case).');
      names.add(key);
    }
    return;
  }
  const { error } = unitCatalogSchema.validate(value, { convert: false });
  if (error) throw new AppError('VALIDATION_ERROR', 400, `Invalid unit settings: ${error.details[0].message}`);
  if (mergeCatalog(value).filter((unit) => !unit.deleted).length > 300) throw new AppError('VALIDATION_ERROR', 400, 'The catalog supports up to 300 units.');
  const symbols = new Set();
  for (const unit of value) {
    if (unit.deleted && unit.enabled) throw new AppError('VALIDATION_ERROR', 400, 'A deleted unit cannot be available for selection.');
    const key = unit.value.toLowerCase();
    if (symbols.has(key)) throw new AppError('VALIDATION_ERROR', 400, 'Each unit symbol must be unique (ignoring case).');
    symbols.add(key);
  }
};

const normalize = (value) => String(value || '').trim().toLowerCase();
const mergeCatalog = (definitions) => {
  const catalog = new Map(standardUnits.map((unit) => [normalize(unit.value), unit]));
  for (const unit of Array.isArray(definitions) ? definitions : []) {
    if (unit && typeof unit.value === 'string') catalog.set(normalize(unit.value), unit);
  }
  return [...catalog.values()];
};

const lockUnitSettings = (transaction) => {
  const { sequelize } = require('../index');
  return sequelize.query("SELECT pg_advisory_xact_lock(hashtext('catalog.unit-settings'))", { transaction });
};

const readUnitSettings = async (transaction) => {
  const { Setting, Sequelize } = require('../index');
  const rows = await Setting.findAll({ where: { group: 'catalog', key: { [Sequelize.Op.in]: ['unitCatalog', 'unitCategories'] } }, transaction });
  const settings = new Map(rows.map((row) => [row.key, row.value]));
  const units = mergeCatalog(settings.get('unitCatalog')).filter((unit) => !unit.deleted);
  return { units, categories: settings.get('unitCategories') || [...new Set(units.map((unit) => unit.category))] };
};

const ensureUnitCategoriesAllowed = async (changes, transaction) => {
  const relevant = changes.filter(({ key, group }) => group === 'catalog' && ['unitCatalog', 'unitCategories'].includes(key));
  if (!relevant.length) return;
  const { sequelize, Sequelize, Setting } = require('../index');
  // Serialize category changes and unit assignments, including the first save
  // when no settings row exists yet. All unit writers use the same lock.
  await sequelize.query("SELECT pg_advisory_xact_lock(hashtext('catalog.unit-settings'))", { transaction });
  const stored = await Setting.findAll({
    where: { group: 'catalog', key: { [Sequelize.Op.in]: ['unitCatalog', 'unitCategories'] } },
    transaction,
  });
  const proposed = new Map(stored.map((setting) => [setting.key, setting.value]));
  const beforeUnits = mergeCatalog(proposed.get('unitCatalog')).filter((unit) => !unit.deleted);
  const beforeCategories = proposed.get('unitCategories') || [...new Set(beforeUnits.map((unit) => unit.category))];
  const legacyCategories = new Set(mergeCatalog(proposed.get('unitCatalog')).filter((unit) => !unit.deleted).map((unit) => normalizeCategory(unit.category).toLowerCase()));
  for (const setting of relevant) proposed.set(setting.key, setting.value);
  // Existing catalogs supply the initial category list. New categories must
  // still be registered explicitly, rather than appearing through a typo.
  const managed = proposed.has('unitCategories');
  const categories = proposed.get('unitCategories');
  if (managed) validateUnitCatalogSetting('unitCategories', categories, 'catalog');
  const allowed = managed ? new Set(categories) : legacyCategories;
  const unassigned = mergeCatalog(proposed.get('unitCatalog')).find((unit) => !unit.deleted && !allowed.has(managed ? unit.category : normalizeCategory(unit.category).toLowerCase()));
  if (unassigned) throw new AppError('UNIT_CATEGORY_IN_USE', 409, `The category "${unassigned.category}" contains units and must remain in the category list. Only empty categories can be deleted.`);
  if (managed) {
    const removed = beforeCategories.filter((name) => !allowed.has(name));
    const added = categories.filter((name) => !beforeCategories.includes(name));
    if (!removed.length) return;
    const afterUnits = new Map(mergeCatalog(proposed.get('unitCatalog')).filter((unit) => !unit.deleted).map((unit) => [normalize(unit.value), unit]));
    // The manager renames one category at a time, together with all its units.
    const renamed = removed.length === 1 && added.length === 1 && beforeUnits.filter((unit) => unit.category === removed[0])
      .every((unit) => afterUnits.get(normalize(unit.value))?.category === added[0]);
    if (renamed) {
      await sequelize.query('UPDATE attribute_templates SET unit_category = :next WHERE unit_category = :previous', {
        replacements: { previous: removed[0], next: added[0] }, transaction,
      });
    } else {
      const references = await sequelize.query('SELECT unit_category FROM attribute_templates WHERE unit_category IN (:removed) LIMIT 1', {
        replacements: { removed }, type: Sequelize.QueryTypes.SELECT, transaction,
      });
      if (references.length) throw new AppError('UNIT_CATEGORY_IN_USE', 409, 'This category is assigned to an attribute. Update or remove that attribute before deleting the category.');
    }
  }
};

const usageForCatalog = async (catalog, transaction) => {
  const { sequelize, Sequelize } = require('../index');
  // Include drafts, archived products, and recoverable soft-deleted products.
  // Aggregate references instead of loading product/customer data into memory.
  const rows = await sequelize.query(`
    SELECT LOWER(BTRIM(raw_unit)) AS unit, source, COUNT(*)::integer AS count
    FROM (
      SELECT unit AS raw_unit, 'products' AS source FROM products
      UNION ALL SELECT unit, 'attributes' FROM attribute_templates
      UNION ALL SELECT unit_label, 'values' FROM attribute_values
    ) references_to_units
    WHERE raw_unit IS NOT NULL AND BTRIM(raw_unit) <> ''
    GROUP BY LOWER(BTRIM(raw_unit)), source
  `, { type: Sequelize.QueryTypes.SELECT, transaction });

  return Object.fromEntries(catalog.map((unit) => {
    const original = standardUnits.find((candidate) => normalize(candidate.value) === normalize(unit.value));
    const aliases = new Set([unit.value, unit.label, original?.label].filter(Boolean).map(normalize));
    const usage = { products: 0, attributes: 0, values: 0, total: 0 };
    for (const row of rows) {
      if (aliases.has(normalize(row.unit)) && ['products', 'attributes', 'values'].includes(row.source)) {
        usage[row.source] += Number(row.count);
        usage.total += Number(row.count);
      }
    }
    return [normalize(unit.value), usage];
  }));
};

const getUnitUsage = async () => {
  const { Setting } = require('../index');
  const setting = await Setting.findOne({ where: { key: 'unitCatalog', group: 'catalog' } });
  return usageForCatalog(mergeCatalog(setting?.value).filter((unit) => !unit.deleted));
};

const ensureUnitCatalogChangesAllowed = async (key, next, previous, transaction) => {
  if (key !== 'unitCatalog') return;
  const before = mergeCatalog(previous);
  const after = new Map(mergeCatalog(next).map((unit) => [normalize(unit.value), unit]));
  const beforeMap = new Map(before.map((unit) => [normalize(unit.value), unit]));
  const removed = new Map(before.filter((unit) => !unit.deleted && (!after.has(normalize(unit.value)) || after.get(normalize(unit.value)).deleted))
    .map((unit) => [normalize(unit.value), unit]));
  for (const unit of after.values()) {
    if (unit.deleted && !beforeMap.get(normalize(unit.value))?.deleted && !removed.has(normalize(unit.value))) removed.set(normalize(unit.value), unit);
  }
  if (!removed.size) return;
  const { sequelize } = require('../index');
  // Prevent reference writes racing the usage check before this transaction
  // commits. The catalog row is also locked by the settings writer.
  await sequelize.query('LOCK TABLE products, attribute_templates, attribute_values IN SHARE MODE', { transaction });
  const usage = await usageForCatalog([...removed.values()], transaction);
  const used = [...removed.values()].find((unit) => usage[normalize(unit.value)].total > 0);
  if (used) {
    throw new AppError('UNIT_IN_USE', 409, `Cannot delete ${used.label}: it is used by products or attributes. Hide the unit instead.`, usage[normalize(used.value)]);
  }
};

module.exports = { validateUnitCatalogSetting, getUnitUsage, ensureUnitCatalogChangesAllowed, ensureUnitCategoriesAllowed, readUnitSettings, lockUnitSettings };
