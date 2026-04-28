'use strict';

const { sequelize, Setting } = require('../index');
const AuditService = require('../audit/audit.service');
const AppError = require('../../utils/AppError');
const { ACTIONS, ENTITIES } = require('../../config/constants');

const SETTING_KEY   = 'sale_labels';
const SETTING_GROUP = 'sales';

// ─── In-memory cache (60-second TTL) ─────────────────────────────────────────
// Prevents a DB hit on every product serialization call.
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 60_000;

const invalidateCache = () => {
  _cache = null;
  _cacheAt = 0;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toSlug = (text) =>
  String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const validateLabelShape = (label, index) => {
  if (!label || typeof label !== 'object') {
    throw new AppError('VALIDATION_ERROR', 400, `Label at index ${index} must be an object`);
  }
  if (!label.name || typeof label.name !== 'string' || !label.name.trim()) {
    throw new AppError('VALIDATION_ERROR', 400, `Label at index ${index} is missing a valid "name"`);
  }
  if (label.color && !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(label.color)) {
    throw new AppError('VALIDATION_ERROR', 400, `Label at index ${index} has an invalid "color" (must be hex, e.g. #FF0000)`);
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns all sale label presets. Uses an in-memory cache.
 * @returns {Array<{id, name, color, priority, isActive}>}
 */
const getSaleLabels = async () => {
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_TTL_MS) return _cache;

  const row = await Setting.findOne({ where: { key: SETTING_KEY, group: SETTING_GROUP } });
  _cache  = Array.isArray(row?.value) ? row.value : [];
  _cacheAt = now;
  return _cache;
};

/**
 * Replaces the entire sale label catalog. Validates every label, enforces unique ids.
 * @param {Array} labels  Array of { name, color?, priority?, isActive? }
 * @param {string} actingUserId
 */
const replaceSaleLabels = async (labels, actingUserId) => {
  if (!Array.isArray(labels)) {
    throw new AppError('VALIDATION_ERROR', 400, '"labels" must be an array');
  }

  // Validate + normalise each label
  const normalized = labels.map((label, i) => {
    validateLabelShape(label, i);
    return {
      id:       label.id ? toSlug(label.id) : toSlug(label.name),
      name:     String(label.name).trim(),
      color:    label.color || '#EF4444',
      priority: Number.isFinite(label.priority) ? label.priority : i,
      isActive: label.isActive !== false,
    };
  });

  // Enforce unique ids
  const ids = normalized.map((l) => l.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length) {
    throw new AppError('VALIDATION_ERROR', 400, `Duplicate label ids: ${[...new Set(duplicates)].join(', ')}`);
  }

  return sequelize.transaction(async (t) => {
    let existing = await Setting.findOne({ where: { key: SETTING_KEY, group: SETTING_GROUP }, transaction: t });
    const before = existing?.value ?? [];

    if (existing) {
      await existing.update({ value: normalized, updatedBy: actingUserId }, { transaction: t });
    } else {
      existing = await Setting.create(
        { key: SETTING_KEY, value: normalized, group: SETTING_GROUP, updatedBy: actingUserId },
        { transaction: t }
      );
    }

    try {
      await AuditService.log({
        userId:   actingUserId,
        action:   ACTIONS.UPDATE,
        entity:   ENTITIES.SETTING,
        entityId: SETTING_KEY,
        changes:  { before, after: normalized },
      }, t);
    } catch (_) { /* audit failure must not abort the write */ }

    invalidateCache();
    return normalized;
  });
};

/**
 * Creates a single new label and appends it to the catalog.
 */
const createSaleLabel = async (labelData, actingUserId) => {
  validateLabelShape(labelData, 0);

  const labels = await getSaleLabels();
  const newId = labelData.id ? toSlug(labelData.id) : toSlug(labelData.name);

  if (labels.some((l) => l.id === newId)) {
    throw new AppError('CONFLICT', 409, `A sale label with id "${newId}" already exists`);
  }

  const newLabel = {
    id:       newId,
    name:     String(labelData.name).trim(),
    color:    labelData.color || '#EF4444',
    priority: Number.isFinite(labelData.priority) ? labelData.priority : labels.length,
    isActive: labelData.isActive !== false,
  };

  const updated = [...labels, newLabel];
  await replaceSaleLabels(updated, actingUserId);
  return newLabel;
};

/**
 * Updates a single label by id.
 */
const updateSaleLabel = async (id, patch, actingUserId) => {
  const labels = await getSaleLabels();
  const index  = labels.findIndex((l) => l.id === id);

  if (index === -1) throw new AppError('NOT_FOUND', 404, `Sale label "${id}" not found`);

  if (patch.color && !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(patch.color)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid "color" — must be a hex value, e.g. #FF0000');
  }

  const updated = labels.map((label, i) => {
    if (i !== index) return label;
    return {
      ...label,
      name:     patch.name     ? String(patch.name).trim()                   : label.name,
      color:    patch.color    ? patch.color                                 : label.color,
      priority: Number.isFinite(patch.priority) ? patch.priority             : label.priority,
      isActive: patch.isActive !== undefined    ? Boolean(patch.isActive)    : label.isActive,
    };
  });

  await replaceSaleLabels(updated, actingUserId);
  return updated[index];
};

/**
 * Hard-deletes a label by id.
 * NOTE: Products with saleLabel = this id will surface a null resolved label until re-labelled.
 */
const deleteSaleLabel = async (id, actingUserId) => {
  const labels = await getSaleLabels();
  if (!labels.some((l) => l.id === id)) {
    throw new AppError('NOT_FOUND', 404, `Sale label "${id}" not found`);
  }

  const updated = labels.filter((l) => l.id !== id);
  await replaceSaleLabels(updated, actingUserId);
  return true;
};

/**
 * Returns a single label object by its id, or null.
 */
const getSaleLabelById = async (id) => {
  const labels = await getSaleLabels();
  return labels.find((l) => l.id === id) ?? null;
};

module.exports = {
  getSaleLabels,
  getSaleLabelById,
  createSaleLabel,
  updateSaleLabel,
  deleteSaleLabel,
  replaceSaleLabels,
  invalidateSaleLabelCache: invalidateCache,
};
