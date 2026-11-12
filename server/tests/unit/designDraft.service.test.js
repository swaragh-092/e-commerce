import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { DesignDraft, Setting, sequelize } = require('../../src/modules');
afterEach(() => vi.restoreAllMocks());
const DesignDraftService = require('../../src/modules/settings/designDraft.service');

describe('Design draft safety', () => {
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
