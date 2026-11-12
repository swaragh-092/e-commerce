import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { DesignDraft, DesignDraftVersion, DesignDraftArchive, Setting, sequelize } = require('../../src/modules');
afterEach(() => vi.restoreAllMocks());
const AuditService = require('../../src/modules/audit/audit.service');
const DesignDraftService = require('../../src/modules/settings/designDraft.service');

describe('Design draft safety', () => {
  it.each([
    { draftRevision: 1, lastPublishedRevision: 46, expected: 47 },
    { draftRevision: 46, lastPublishedRevision: 46, expected: 47 },
    { draftRevision: 50, lastPublishedRevision: 46, expected: 50 },
    { draftRevision: 1, lastPublishedRevision: null, expected: 1 },
  ])('publishes above retained history without reusing a revision: %j', async ({ draftRevision, lastPublishedRevision, expected }) => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    const draft = {
      id: 'draft', status: 'draft', revision: draftRevision, payload: [], baseSnapshot: {},
      toJSON() { return { revision: this.revision, status: this.status }; },
      update: vi.fn(async function (values) { Object.assign(this, values); return this; }),
    };
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (fn) => fn(transaction));
    vi.spyOn(DesignDraft, 'findOne').mockResolvedValue(draft);
    vi.spyOn(Setting, 'findAll').mockResolvedValue([]);
    vi.spyOn(DesignDraftVersion, 'max').mockResolvedValue(lastPublishedRevision);
    vi.spyOn(DesignDraftVersion, 'create').mockImplementation(async (values) => ({ toJSON: () => values }));
    vi.spyOn(AuditService, 'log').mockResolvedValue();
    const result = await DesignDraftService.publishDraft({ expectedRevision: draftRevision }, { id: 'user' });
    expect(DesignDraft.findOne).toHaveBeenCalledWith(expect.objectContaining({ transaction, lock: 'UPDATE' }));
    expect(DesignDraftVersion.max).toHaveBeenCalledWith('revision', { where: { draftKey: 'store' }, transaction });
    expect(result.version.revision).toBe(expected);
    expect(result.draft.revision).toBe(expected + 1);
    expect(result.published).toBe(true);
  });

  it('reports stale live settings on load without modifying the saved draft', async () => {
    const draft = { status: 'draft', revision: 46, baseSnapshot: { theme: { primaryColor: '#000000' } }, payload: [{ group: 'theme', key: 'primaryColor', value: '#111111' }], toJSON() { return { ...this }; } };
    vi.spyOn(DesignDraft, 'findOne').mockResolvedValue(draft);
    vi.spyOn(Setting, 'findAll').mockResolvedValue([{ group: 'theme', key: 'primaryColor', value: '#ffffff' }]);
    const result = await DesignDraftService.getDraft();
    expect(result.conflicts).toEqual([{ group: 'theme', key: 'primaryColor' }]);
    expect(result.draft.revision).toBe(46);
    expect(result.draft).not.toHaveProperty('baseSnapshot');
  });

  it('does not discard a draft edited in another session', async () => {
    const destroy = vi.fn();
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (fn) => fn({ LOCK: { UPDATE: 'UPDATE' } }));
    vi.spyOn(DesignDraft, 'findOne').mockResolvedValue({ status: 'draft', revision: 47, destroy, toJSON: () => ({ revision: 47 }) });
    await expect(DesignDraftService.discardDraft({ id: 'user' }, 46)).rejects.toMatchObject({ code: 'DRAFT_CONFLICT' });
    expect(destroy).not.toHaveBeenCalled();
  });

  it('archives before deleting a discarded draft and preserves it if archiving fails', async () => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    const destroy = vi.fn();
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (fn) => fn(transaction));
    vi.spyOn(DesignDraft, 'findOne').mockResolvedValue({
      id: 'draft', draftKey: 'store', status: 'draft', revision: 4, payload: [], baseSnapshot: {}, destroy,
    });
    vi.spyOn(DesignDraftArchive, 'create').mockRejectedValue(new Error('archive failed'));
    await expect(DesignDraftService.discardDraft({ id: 'user' }, 4)).rejects.toThrow('archive failed');
    expect(DesignDraftArchive.create).toHaveBeenCalledWith(expect.objectContaining({ revision: 4, archivedBy: 'user' }), { transaction });
    expect(destroy).not.toHaveBeenCalled();
  });

  it('restores an archive at the next revision against the fresh live snapshot', async () => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    const draft = { id: 'draft', status: 'draft', revision: 8, update: vi.fn(async function (values) { Object.assign(this, values); return this; }), toJSON() { return { ...this }; } };
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (fn) => fn(transaction));
    vi.spyOn(DesignDraftArchive, 'findOne').mockResolvedValue({ id: 'archive', revision: 3, payload: [{ group: 'theme', key: 'primaryColor', value: '#111' }], baseSnapshot: { ignored: true } });
    vi.spyOn(DesignDraftArchive, 'create').mockResolvedValue({});
    vi.spyOn(DesignDraft, 'findOne').mockResolvedValue(draft);
    vi.spyOn(Setting, 'findAll').mockResolvedValue([{ group: 'theme', key: 'primaryColor', value: '#fff' }]);
    const auditLog = vi.spyOn(AuditService, 'log').mockResolvedValue();
    const result = await DesignDraftService.restoreArchivedDraft({ archiveId: 'archive', expectedRevision: 8 }, { id: 'user' });
    expect(draft.update).toHaveBeenCalledWith(expect.objectContaining({ revision: 9, baseSnapshot: { theme: { primaryColor: '#fff' } }, payload: [{ group: 'theme', key: 'primaryColor', value: '#111', operation: 'upsert' }] }), { transaction });
    expect(result.draft.baseSnapshot).toBeUndefined();
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ changes: expect.objectContaining({ action: 'restore-archive', archiveId: 'archive' }) }), transaction);
  });

  it('does not replace a draft or log a restore if archiving the current draft fails', async () => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    const update = vi.fn();
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (fn) => fn(transaction));
    vi.spyOn(DesignDraftArchive, 'findOne').mockResolvedValue({ id: 'archive', revision: 2, payload: [] });
    vi.spyOn(DesignDraftArchive, 'create').mockRejectedValue(new Error('archive failed'));
    vi.spyOn(DesignDraft, 'findOne').mockResolvedValue({ status: 'draft', revision: 8, update });
    const auditLog = vi.spyOn(AuditService, 'log').mockResolvedValue();
    await expect(DesignDraftService.restoreArchivedDraft({ archiveId: 'archive', expectedRevision: 8 }, { id: 'user' })).rejects.toThrow('archive failed');
    expect(update).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('omits archive payload and base snapshot from archive metadata', async () => {
    const row = { toJSON: () => ({ id: 'archive', payload: ['private'], baseSnapshot: { private: true }, revision: 3 }) };
    vi.spyOn(DesignDraftArchive, 'findAll').mockResolvedValue([row]);
    const result = await DesignDraftService.getArchivedDrafts();
    expect(DesignDraftArchive.findAll).toHaveBeenCalledWith(expect.objectContaining({ attributes: { exclude: ['payload', 'baseSnapshot'] } }));
    expect(result.archives[0]).not.toHaveProperty('payload');
    expect(result.archives[0]).not.toHaveProperty('baseSnapshot');
  });

  it('ignores object key order but preserves array order when comparing live settings', () => {
    const payload = [{ group: 'homepage', key: 'sections', value: [{ id: 'draft' }] }];
    expect(DesignDraftService.findPublishConflicts(
      { homepage: { sections: [{ id: 'hero', enabled: true }] } },
      { homepage: { sections: [{ enabled: true, id: 'hero' }] } },
      payload,
    )).toEqual([]);
    expect(DesignDraftService.findPublishConflicts(
      { homepage: { sections: [{ id: 'hero' }, { id: 'footer' }] } },
      { homepage: { sections: [{ id: 'footer' }, { id: 'hero' }] } },
      payload,
    )).toEqual([{ group: 'homepage', key: 'sections' }]);
  });

  it('allows live changes that already match the desired draft value', () => {
    expect(DesignDraftService.findPublishConflicts(
      { theme: { primaryColor: '#000000' } },
      { theme: { primaryColor: '#ffffff' } },
      [{ group: 'theme', key: 'primaryColor', value: '#ffffff' }],
    )).toEqual([]);
  });

  it('allows a reset when the live override has already been removed', () => {
    expect(DesignDraftService.findPublishConflicts(
      { theme: { radius: 12 } },
      {},
      [{ group: 'theme', key: 'radius', operation: 'delete' }],
    )).toEqual([]);
  });

  it('accepts Designer settings and rejects operational groups', () => {
    expect(DesignDraftService.normalizePayload([
      { group: 'theme', key: 'primaryColor', value: '#0f766e' },
      { group: 'advanced', key: 'customCSS', value: '.card { color: red; }' },
    ])).toHaveLength(2);

    expect(() => DesignDraftService.normalizePayload([
      { group: 'payments', key: 'codEnabled', value: true },
    ])).toThrow(/not allowed/);
  });

  it('only permits custom CSS in the advanced group', () => {
    expect(() => DesignDraftService.normalizePayload([
      { group: 'advanced', key: 'scripts', value: '<script />' },
    ])).toThrow(/not allowed/);
  });

  it('normalizes reset operations and keeps the last operation per setting', () => {
    const payload = DesignDraftService.normalizePayload([
      { group: 'theme', key: 'radius', value: 12 },
      { group: 'theme', key: 'radius', operation: 'delete' },
    ]);

    expect(payload).toEqual([{ group: 'theme', key: 'radius', operation: 'delete' }]);
  });

  it('freezes the published payload at the draft revision before incrementing it', () => {
    const publishedAt = new Date('2026-09-23T12:00:00.000Z');
    expect(DesignDraftService.buildPublishedVersion({
      revision: 7,
      payload: [{ group: 'theme', key: 'primaryColor', value: '#0f766e' }],
    }, 'user-1', publishedAt)).toEqual({
      draftKey: 'store',
      revision: 7,
      payload: [{ group: 'theme', key: 'primaryColor', value: '#0f766e' }],
      publishedAt,
      publishedBy: 'user-1',
    });
  });

  it('detects live changes that conflict with the draft base snapshot', () => {
    const conflicts = DesignDraftService.findPublishConflicts(
      { theme: { primaryColor: '#0f766e' } },
      { theme: { primaryColor: '#be123c' } },
      [{ group: 'theme', key: 'primaryColor', value: '#111827' }],
    );

    expect(conflicts).toEqual([{ group: 'theme', key: 'primaryColor' }]);
  });

  it('detects a live override added after the draft started', () => {
    const conflicts = DesignDraftService.findPublishConflicts(
      { theme: {} },
      { theme: { radius: 16 } },
      [{ group: 'theme', key: 'radius', value: 12 }],
    );

    expect(conflicts).toEqual([{ group: 'theme', key: 'radius' }]);
  });

  it('allows publishing when the live base remains unchanged', () => {
    const conflicts = DesignDraftService.findPublishConflicts(
      { theme: { primaryColor: '#0f766e' } },
      { theme: { primaryColor: '#0f766e' } },
      [{ group: 'theme', key: 'primaryColor', value: '#111827' }],
    );

    expect(conflicts).toEqual([]);
  });

  it('protects a staged reset when the live override changes', () => {
    const conflicts = DesignDraftService.findPublishConflicts(
      { theme: { radius: 12 } },
      { theme: { radius: 16 } },
      [{ group: 'theme', key: 'radius', operation: 'delete' }],
    );

    expect(conflicts).toEqual([{ group: 'theme', key: 'radius' }]);
  });
});
