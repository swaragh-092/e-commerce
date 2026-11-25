'use strict';

const { createHash, randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { sequelize, Setting, DesignDraft, DesignDraftVersion, DesignDraftArchive } = require('../index');
const SettingsService = require('./settings.service');
const AuditService = require('../audit/audit.service');
const AppError = require('../../utils/AppError');
const { getPermissionsForUser, PERMISSIONS } = require('../../config/permissions');
const { DESIGN_DRAFT_KEY, DESIGN_DRAFT_GROUPS, isDesignDraftTarget } = require('./designDraft');

const { TEMPLATE_ASSIGNMENT_KEYS, buildAlternateTemplatesSchema } = require('./alternateTemplates');
const { productBlockPlacementSchema, productDetailsOrderSchema, themeHeaderLinksSchema } = require('../theme/theme.validation');

const valuesEqual = isDeepStrictEqual;

const alternateTemplateSchemas = Object.fromEntries(Object.entries(TEMPLATE_ASSIGNMENT_KEYS)
  .map(([group, assignmentKey]) => [group, buildAlternateTemplatesSchema(assignmentKey).required()]));

const validateProductBlockPlacements = (sections) => {
  if (!Array.isArray(sections)) return;
  for (const section of sections) {
    if (section?.type !== 'product-info') continue;
    const { error: orderError } = productDetailsOrderSchema.validate(section.detailsBlockOrder, { convert: false });
    if (orderError) throw new AppError('VALIDATION_ERROR', 400, `Invalid product details order: ${orderError.details[0].message}`);
    for (const block of Array.isArray(section.heroBlocks) ? section.heroBlocks : []) {
      const { error } = productBlockPlacementSchema.validate(block?.productPlacement, { convert: false });
      if (error) throw new AppError('VALIDATION_ERROR', 400, `Invalid product block placement: ${error.details[0].message}`);
    }
  }
};

const serializeDraft = (draft) => {
  if (!draft) return null;
  const value = draft.toJSON();
  if (value.baseSnapshot?.templateSource) value.templateSource = value.baseSnapshot.templateSource;
  if (value.baseSnapshot?.draftName) value.name = value.baseSnapshot.draftName;
  delete value.baseSnapshot;
  return value;
};

const serializeVersion = (version, { includePayload = false } = {}) => {
  if (!version) return null;
  const value = version.toJSON();
  if (!includePayload) delete value.payload;
  return value;
};

const serializeArchive = (archive) => {
  const value = archive.toJSON();
  delete value.payload;
  delete value.baseSnapshot;
  return value;
};

const buildPublishedVersion = (draft, userId, publishedAt = new Date()) => ({
  draftKey: DESIGN_DRAFT_KEY,
  revision: Number(draft.revision) || 1,
  payload: draft.payload || [],
  publishedAt,
  publishedBy: userId,
});

const archiveDraft = (draft, userId, transaction) => DesignDraftArchive.create({
  draftKey: draft.draftKey,
  revision: draft.revision,
  payload: draft.payload,
  baseSnapshot: draft.baseSnapshot,
  archivedBy: userId,
}, { transaction });

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
    const templateSchema = alternateTemplateSchemas[group];
    if (operation === 'upsert' && group === 'nav' && key === 'headerLinks') {
      const { error } = themeHeaderLinksSchema.validate(entry.value, { convert: false });
      if (error) throw new AppError('VALIDATION_ERROR', 400, error.details[0].message);
    }
    if (operation === 'upsert' && key === 'alternateTemplates' && templateSchema) {
      const { error } = templateSchema.validate(entry.value, { convert: false });
      if (error) throw new AppError('VALIDATION_ERROR', 400, error.details[0].message);
      if (group === 'productPage') entry.value.forEach(({ settings }) => validateProductBlockPlacements(settings.sections));
    } else if (operation === 'upsert' && group === 'productPage' && key === 'sections') {
      validateProductBlockPlacements(entry.value);
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

const findDraft = async (transaction = null, { lock = false, draftKey = DESIGN_DRAFT_KEY } = {}) => {
  const options = { where: { draftKey } };
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

const getDraft = async (draftKey = DESIGN_DRAFT_KEY) => {
  const draft = await findDraft(null, { draftKey });
  if (draft?.status !== 'draft') return { draft: null, conflicts: [] };
  const currentSnapshot = await readLiveSnapshot();
  return {
    draft: serializeDraft(draft),
    conflicts: findPublishConflicts(draft.baseSnapshot || {}, currentSnapshot, draft.payload || []),
  };
};

const listNamedDrafts = async () => {
  const drafts = await DesignDraft.findAll({ where: { status: 'draft' }, order: [['updatedAt', 'DESC']] });
  return drafts.filter(({ draftKey }) => draftKey !== DESIGN_DRAFT_KEY).map((draft) => {
    const { draftKey, name, revision, updatedAt } = serializeDraft(draft);
    return { draftKey, name, revision, updatedAt };
  });
};

const createNamedDraft = async ({ name, sourceDraftKey }, user) => sequelize.transaction(async (transaction) => {
  const source = sourceDraftKey ? await findDraft(transaction, { draftKey: sourceDraftKey, lock: true }) : null;
  if (sourceDraftKey && source?.status !== 'draft') throw new AppError('NOT_FOUND', 404, 'The source draft is unavailable.');
  const live = await readLiveSnapshot(transaction);
  const includeAdvanced = getPermissionsForUser(user).includes(PERMISSIONS.SETTINGS_ADVANCED);
  const groups = DESIGN_DRAFT_GROUPS.filter((group) => group !== 'advanced' || includeAdvanced);
  const snapshotEntries = groups.flatMap((group) => Object.entries({
    ...(group === 'nav' && { headerLinks: false }), ...SettingsService.getGroupDefaults(group), ...live[group],
  })
    .filter(([key, value]) => value !== undefined && isDesignDraftTarget(group, key))
    .map(([key, value]) => value === null ? { group, key, operation: 'delete' } : { group, key, value }));
  const payload = normalizePayload([...snapshotEntries, ...(source?.payload || []).filter(({ group }) => groups.includes(group))]);
  const created = await DesignDraft.create({
    draftKey: `named-${randomUUID()}`, status: 'draft', revision: 1, payload,
    baseSnapshot: { ...(source?.baseSnapshot || live), draftName: name },
    createdBy: user.id, updatedBy: user.id,
  }, { transaction });
  return serializeDraft(created);
});

const renameNamedDraft = async ({ draftKey, name, expectedRevision }, user) => sequelize.transaction(async (transaction) => {
  const draft = await findDraft(transaction, { draftKey, lock: true });
  if (draft?.status !== 'draft') throw new AppError('NOT_FOUND', 404, 'The draft is unavailable.');
  assertRevision(draft, expectedRevision);
  return serializeDraft(await draft.update({
    baseSnapshot: { ...draft.baseSnapshot, draftName: name },
    revision: draft.revision + 1,
    updatedBy: user.id,
  }, { transaction }));
});

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

const getArchivedDrafts = async ({ limit = 30 } = {}) => {
  const safeLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 30));
  const archives = await DesignDraftArchive.findAll({
    where: { draftKey: DESIGN_DRAFT_KEY }, order: [['createdAt', 'DESC']], limit: safeLimit,
    attributes: { exclude: ['payload', 'baseSnapshot'] },
  });
  return { archives: archives.map(serializeArchive) };
};

const saveDraft = async ({ settings, expectedRevision, draftKey = DESIGN_DRAFT_KEY }, user, { merge = false, templateSource } = {}) => {
  const writes = normalizePayload(settings);

  return sequelize.transaction(async (t) => {
    const draft = await findDraft(t, { lock: true, draftKey });
    if (draftKey !== DESIGN_DRAFT_KEY && draft?.status !== 'draft') {
      throw new AppError('NOT_FOUND', 404, 'The named draft is unavailable.');
    }
    if (draft?.status === 'draft' && !merge) assertRevision(draft, expectedRevision);

    const payload = merge && draft?.status === 'draft' ? normalizePayload([...draft.payload, ...writes]) : writes;
    assertDraftPermissions(payload, user);

    const baseline = draft?.status === 'draft'
      ? draft.baseSnapshot
      : await readLiveSnapshot(t, { lock: true });
    const baseSnapshot = templateSource === undefined ? baseline : { ...baseline, templateSource };

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
  for (const { group, key, value, operation } of payload) {
    const baseKeys = baseSnapshot?.[group] || {};
    const currentKeys = currentSnapshot?.[group] || {};
    const hasBase = Object.prototype.hasOwnProperty.call(baseKeys, key);
    const hasCurrent = Object.prototype.hasOwnProperty.call(currentKeys, key);
    // A concurrent change to the same desired result needs no overwrite.
    if (operation === 'delete' ? !hasCurrent : hasCurrent && valuesEqual(value, currentKeys[key])) continue;
    if (hasBase !== hasCurrent || (hasBase && !valuesEqual(baseKeys[key], currentKeys[key]))) {
      conflicts.push({ group, key });
    }
  }
  return conflicts;
};

const publishDraft = async ({ expectedRevision, conflictToken, draftKey = DESIGN_DRAFT_KEY }, user) => sequelize.transaction(async (t) => {
  const draft = await findDraft(t, { lock: true, draftKey });
  if (!draft || draft.status !== 'draft') {
    throw new AppError('NOT_FOUND', 404, 'No saved design draft is available to publish.');
  }
  assertRevision(draft, expectedRevision);
  assertDraftPermissions(draft.payload || [], user);

  const currentSnapshot = await readLiveSnapshot(t, { lock: true });
  const conflicts = findPublishConflicts(draft.baseSnapshot || {}, currentSnapshot, draft.payload || []);
  const reviewedToken = conflicts.length
    ? createHash('sha256').update(JSON.stringify([
      draft.draftKey || draftKey, draft.revision,
      conflicts.map(({ group, key }) => [group, key, currentSnapshot[group]?.[key]]),
    ])).digest('hex')
    : null;
  if (conflicts.length && conflictToken !== reviewedToken) {
    throw new AppError(
      'DRAFT_CONFLICT',
      409,
      'The live design changed after this draft was started. Review the conflicting settings before publishing.',
      { conflicts, conflictToken: reviewedToken, currentRevision: draft.revision, draft: serializeDraft(draft) },
    );
  }

  const writes = (draft.payload || []).filter((entry) => entry.operation !== 'delete');
  const deletes = (draft.payload || []).filter((entry) => entry.operation === 'delete');
  if (writes.length) await SettingsService.bulkUpdate(writes, user.id, user, { transaction: t });
  for (const { group, key } of deletes) {
    await Setting.destroy({ where: { group, key }, transaction: t });
  }
  const publishedAt = new Date();
  // Discarding a draft resets its counter, but published history survives.
  // The locked draft serializes publishers while we allocate the next version.
  const lastPublishedRevision = await DesignDraftVersion.max('revision', {
    where: { draftKey: DESIGN_DRAFT_KEY },
    transaction: t,
  });
  const publishedRevision = Math.max(Number(draft.revision) || 1, (Number(lastPublishedRevision) || 0) + 1);
  const version = await DesignDraftVersion.create(buildPublishedVersion({
    revision: publishedRevision,
    payload: draft.payload,
  }, user.id, publishedAt), { transaction: t });
  const published = await draft.update({
    status: 'published',
    revision: publishedRevision + 1,
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

  if (draft?.status === 'draft') await archiveDraft(draft, user.id, t);
  const baseSnapshot = { ...(draft?.status === 'draft'
    ? draft.baseSnapshot
    : await readLiveSnapshot(t, { lock: true })) };
  delete baseSnapshot.templateSource;

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

const discardDraft = async (user, expectedRevision, draftKey = DESIGN_DRAFT_KEY) => sequelize.transaction(async (t) => {
  const draft = await findDraft(t, { lock: true, draftKey });
  if (!draft || draft.status !== 'draft') return { discarded: false };
  assertRevision(draft, expectedRevision);
  await DesignDraftArchive.create({
    draftKey: draft.draftKey, revision: draft.revision, payload: draft.payload,
    baseSnapshot: draft.baseSnapshot, archivedBy: user.id,
  }, { transaction: t });
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

const restoreArchivedDraft = async ({ archiveId, expectedRevision }, user) => sequelize.transaction(async (t) => {
  const archive = await DesignDraftArchive.findOne({
    where: { id: archiveId, draftKey: DESIGN_DRAFT_KEY }, transaction: t,
    lock: t.LOCK ? t.LOCK.UPDATE : 'UPDATE',
  });
  if (!archive) throw new AppError('NOT_FOUND', 404, 'Archived design draft not found.');
  const payload = normalizePayload(archive.payload || []);
  assertDraftPermissions(payload, user);
  const draft = await findDraft(t, { lock: true });
  if (draft?.status === 'draft') assertRevision(draft, expectedRevision);

  if (draft?.status === 'draft') await archiveDraft(draft, user.id, t);
  const baseSnapshot = await readLiveSnapshot(t, { lock: true });
  const values = { revision: (Number(draft?.revision) || 0) + 1, status: 'draft', payload, baseSnapshot, updatedBy: user.id, publishedAt: null, publishedBy: null };
  const restored = draft
    ? await draft.update(values, { transaction: t })
    : await DesignDraft.create({ draftKey: DESIGN_DRAFT_KEY, ...values, createdBy: user.id }, { transaction: t });
  await AuditService.log({
    userId: user.id,
    action: 'UPDATE',
    entity: 'DesignDraft',
    entityId: restored.id,
    changes: { action: 'restore-archive', archiveId: archive.id, archiveRevision: archive.revision, revision: restored.revision },
  }, t);
  return { draft: serializeDraft(restored) };
});

module.exports = {
  DESIGN_DRAFT_GROUPS,
  getDraft,
  listNamedDrafts,
  createNamedDraft,
  renameNamedDraft,
  getPublishedVersions,
  getArchivedDrafts,
  saveDraft,
  publishDraft,
  restorePublishedVersion,
  buildPublishedVersion,
  discardDraft,
  restoreArchivedDraft,
  findPublishConflicts,
  normalizePayload,
};
