'use strict';

const { sequelize, Setting, DesignDraft, DesignDraftVersion } = require('../index');
const SettingsService = require('./settings.service');
const AuditService = require('../audit/audit.service');
const AppError = require('../../utils/AppError');
const { getPermissionsForUser, PERMISSIONS } = require('../../config/permissions');
const { DESIGN_DRAFT_KEY, DESIGN_DRAFT_GROUPS, isDesignDraftTarget } = require('./designDraft');

const valuesEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const serializeDraft = (draft) => {
  if (!draft) return null;
  const value = draft.toJSON();
  delete value.baseSnapshot;
  return value;
};

const serializeVersion = (version, { includePayload = false } = {}) => {
  if (!version) return null;
  const value = version.toJSON();
  if (!includePayload) delete value.payload;
  return value;
};

const buildPublishedVersion = (draft, userId, publishedAt = new Date()) => ({
  draftKey: DESIGN_DRAFT_KEY,
  revision: Number(draft.revision) || 1,
  payload: draft.payload || [],
  publishedAt,
  publishedBy: userId,
});

const readLiveSnapshot = async (transaction = null, { lock = false } = {}) => {
  const options = { where: { group: DESIGN_DRAFT_GROUPS } };
  if (transaction) options.transaction = transaction;
  if (lock && transaction) options.lock = transaction.LOCK ? transaction.LOCK.UPDATE : 'UPDATE';

  const rows = await Setting.findAll(options);
  const snapshot = {};
  for (const row of rows) {
    if (!isDesignDraftTarget(row.group, row.key)) continue;
    if (!snapshot[row.group]) snapshot[row.group] = {};
    snapshot[row.group][row.key] = row.value;
  }
  return snapshot;
};

const normalizePayload = (settings) => {
  if (!Array.isArray(settings) || settings.length > 1000) {
    throw new AppError('VALIDATION_ERROR', 400, 'Design draft must contain between 0 and 1000 settings.');
  }

  const normalized = settings.map((entry) => {
    const group = entry?.group;
    const key = entry?.key;
    if (typeof group !== 'string' || typeof key !== 'string' || !key.trim() || !isDesignDraftTarget(group, key)) {
      throw new AppError('VALIDATION_ERROR', 400, `Setting '${group || 'unknown'}.${key || 'unknown'}' is not allowed in a design draft.`);
    }
    const operation = entry.operation === 'delete' ? 'delete' : 'upsert';
    if (operation === 'upsert' && !Object.prototype.hasOwnProperty.call(entry, 'value')) {
      throw new AppError('VALIDATION_ERROR', 400, `Design draft setting '${group}.${key}' is missing a value.`);
    }
    return operation === 'delete'
      ? { group, key, operation }
      : { group, key, operation, value: entry.value };
  });

  // Keep the last operation for a target so a malformed client payload cannot
  // both restore and delete the same setting during publish.
  return [...new Map(normalized.map((entry) => [`${entry.group}.${entry.key}`, entry])).values()];
};

const assertDraftPermissions = (payload, user) => {
  const touchesAdvanced = payload.some(({ group }) => group === 'advanced');
  if (touchesAdvanced && !getPermissionsForUser(user || {}).includes(PERMISSIONS.SETTINGS_ADVANCED)) {
    throw new AppError('SETTINGS_ADVANCED_REQUIRED', 403, 'Advanced design settings require the settings.advanced permission.');
  }
};

const findDraft = async (transaction = null, { lock = false } = {}) => {
  const options = { where: { draftKey: DESIGN_DRAFT_KEY } };
  if (transaction) options.transaction = transaction;
  if (lock && transaction) options.lock = transaction.LOCK ? transaction.LOCK.UPDATE : 'UPDATE';
  return DesignDraft.findOne(options);
};

const assertRevision = (draft, expectedRevision) => {
  if (!draft) return;
  if (expectedRevision === undefined || expectedRevision === null || Number(draft.revision) !== Number(expectedRevision)) {
    throw new AppError(
      'DRAFT_CONFLICT',
      409,
      'This design draft changed in another session. Reload it before saving.',
      { currentRevision: draft?.revision || null, draft: serializeDraft(draft) },
    );
  }
};

const getDraft = async () => {
  const draft = await findDraft();
  return { draft: draft?.status === 'draft' ? serializeDraft(draft) : null };
};

const getPublishedVersions = async ({ limit = 30 } = {}) => {
  const safeLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 30));
  const versions = await DesignDraftVersion.findAll({
    where: { draftKey: DESIGN_DRAFT_KEY },
    order: [['publishedAt', 'DESC']],
    limit: safeLimit,
    attributes: { exclude: ['payload'] },
    include: [{ association: 'publisher', attributes: ['id', 'firstName', 'lastName', 'email'] }],
  });
  return { versions: versions.map((version) => serializeVersion(version)) };
};

const saveDraft = async ({ settings, expectedRevision }, user) => {
  const payload = normalizePayload(settings);
  assertDraftPermissions(payload, user);

  return sequelize.transaction(async (t) => {
    const draft = await findDraft(t, { lock: true });
    if (draft?.status === 'draft') assertRevision(draft, expectedRevision);

    const baseSnapshot = draft?.status === 'draft'
      ? draft.baseSnapshot
      : await readLiveSnapshot(t, { lock: true });

    let saved;
    if (draft) {
      saved = await draft.update({
        revision: (Number(draft.revision) || 0) + 1,
        status: 'draft',
        payload,
        baseSnapshot,
        updatedBy: user.id,
        publishedAt: null,
        publishedBy: null,
      }, { transaction: t });
    } else {
      saved = await DesignDraft.create({
        draftKey: DESIGN_DRAFT_KEY,
        revision: 1,
        status: 'draft',
        payload,
        baseSnapshot,
        createdBy: user.id,
        updatedBy: user.id,
      }, { transaction: t });
    }

    try {
      await AuditService.log({
        userId: user.id,
        action: 'UPDATE',
        entity: 'DesignDraft',
        entityId: saved.id,
        changes: { action: 'save', revision: saved.revision, settingCount: payload.length },
      }, t);
    } catch (err) { /* audit failure must not prevent the draft save */ }

    return serializeDraft(saved);
  });
};

const findPublishConflicts = (baseSnapshot, currentSnapshot, payload) => {
  const conflicts = [];
  for (const { group, key } of payload) {
    const baseKeys = baseSnapshot?.[group] || {};
    const currentKeys = currentSnapshot?.[group] || {};
    const hasBase = Object.prototype.hasOwnProperty.call(baseKeys, key);
    const hasCurrent = Object.prototype.hasOwnProperty.call(currentKeys, key);
    if (hasBase !== hasCurrent || (hasBase && !valuesEqual(baseKeys[key], currentKeys[key]))) {
      conflicts.push({ group, key });
    }
  }
  return conflicts;
};

const publishDraft = async ({ expectedRevision }, user) => sequelize.transaction(async (t) => {
  const draft = await findDraft(t, { lock: true });
  if (!draft || draft.status !== 'draft') {
    throw new AppError('NOT_FOUND', 404, 'No saved design draft is available to publish.');
  }
  assertRevision(draft, expectedRevision);
  assertDraftPermissions(draft.payload || [], user);

  const currentSnapshot = await readLiveSnapshot(t, { lock: true });
  const conflicts = findPublishConflicts(draft.baseSnapshot || {}, currentSnapshot, draft.payload || []);
  if (conflicts.length) {
    throw new AppError(
      'DRAFT_CONFLICT',
      409,
      'The live design changed after this draft was started. Review the conflicting settings before publishing.',
      { conflicts, currentRevision: draft.revision, draft: serializeDraft(draft) },
    );
  }

  const writes = (draft.payload || []).filter((entry) => entry.operation !== 'delete');
  const deletes = (draft.payload || []).filter((entry) => entry.operation === 'delete');
  if (writes.length) await SettingsService.bulkUpdate(writes, user.id, user, { transaction: t });
  for (const { group, key } of deletes) {
    await Setting.destroy({ where: { group, key }, transaction: t });
  }
  const publishedAt = new Date();
  const version = await DesignDraftVersion.create(buildPublishedVersion(draft, user.id, publishedAt), { transaction: t });
  const published = await draft.update({
    status: 'published',
    revision: (Number(draft.revision) || 0) + 1,
    updatedBy: user.id,
    publishedAt,
    publishedBy: user.id,
  }, { transaction: t });

  try {
    await AuditService.log({
      userId: user.id,
      action: 'UPDATE',
      entity: 'DesignDraft',
      entityId: draft.id,
      changes: { action: 'publish', revision: published.revision, settingCount: (draft.payload || []).length },
    }, t);
  } catch (err) { /* audit failure must not prevent publishing */ }

  return {
    published: true,
    draft: serializeDraft(published),
    version: serializeVersion(version),
    conflicts: [],
  };
});

const restorePublishedVersion = async ({ versionId, expectedRevision }, user) => sequelize.transaction(async (t) => {
  const version = await DesignDraftVersion.findOne({
    where: { id: versionId, draftKey: DESIGN_DRAFT_KEY },
    transaction: t,
    lock: t.LOCK ? t.LOCK.UPDATE : 'UPDATE',
  });
  if (!version) throw new AppError('NOT_FOUND', 404, 'Published design version not found.');

  const payload = normalizePayload(version.payload || []);
  assertDraftPermissions(payload, user);

  const draft = await findDraft(t, { lock: true });
  if (draft?.status === 'draft') assertRevision(draft, expectedRevision);

  const baseSnapshot = draft?.status === 'draft'
    ? draft.baseSnapshot
    : await readLiveSnapshot(t, { lock: true });

  const nextRevision = (Number(draft?.revision) || 0) + 1;
  const restored = draft
    ? await draft.update({
      revision: nextRevision,
      status: 'draft',
      payload,
      baseSnapshot,
      updatedBy: user.id,
      publishedAt: null,
      publishedBy: null,
    }, { transaction: t })
    : await DesignDraft.create({
      draftKey: DESIGN_DRAFT_KEY,
      revision: 1,
      status: 'draft',
      payload,
      baseSnapshot,
      createdBy: user.id,
      updatedBy: user.id,
    }, { transaction: t });

  try {
    await AuditService.log({
      userId: user.id,
      action: 'UPDATE',
      entity: 'DesignDraft',
      entityId: restored.id,
      changes: { action: 'restore-version', versionId: version.id, versionRevision: version.revision, revision: restored.revision },
    }, t);
  } catch (err) { /* audit failure must not prevent restoring the draft */ }

  return {
    draft: serializeDraft(restored),
    restoredVersion: serializeVersion(version),
  };
});

const discardDraft = async (user) => sequelize.transaction(async (t) => {
  const draft = await findDraft(t, { lock: true });
  if (!draft || draft.status !== 'draft') return { discarded: false };
  await draft.destroy({ transaction: t });
  try {
    await AuditService.log({
      userId: user.id,
      action: 'DELETE',
      entity: 'DesignDraft',
      entityId: draft.id,
      changes: { action: 'discard', revision: draft.revision },
    }, t);
  } catch (err) { /* audit failure must not prevent discard */ }
  return { discarded: true };
});

module.exports = {
  DESIGN_DRAFT_GROUPS,
  getDraft,
  getPublishedVersions,
  saveDraft,
  publishDraft,
  restorePublishedVersion,
  buildPublishedVersion,
  discardDraft,
  findPublishConflicts,
  normalizePayload,
};
