'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const db = require('../../src/modules');
const AuditService = require('../../src/modules/audit/audit.service');
const service = require('../../src/modules/settings/designDraft.service');
const versionMigration = require('../../migrations/20260923110000-create-design-draft-versions');
const archiveMigration = require('../../migrations/20261112090000-create-design-draft-archives');

async function main() {
  if (db.sequelize.config.host !== '127.0.0.1' || db.sequelize.config.database !== 'publish_revision_check') {
    throw new Error('This destructive fixture check requires the dedicated local publish_revision_check database.');
  }
  db.sequelize.options.logging = false;
  const qi = db.sequelize.getQueryInterface();
  await db.sequelize.query('CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY)');
  await db.DesignDraft.sync();
  await db.Setting.sync();
  await versionMigration.up(qi, db.Sequelize);
  await archiveMigration.up(qi, db.Sequelize);
  const user = { id: randomUUID() };
  await db.sequelize.query('INSERT INTO users (id) VALUES (:id)', { replacements: user });
  const originalAudit = AuditService.log;
  AuditService.log = async () => {};
  try {
    const first = await service.saveDraft({ settings: [] }, user);
    const published = await service.publishDraft({ expectedRevision: first.revision }, user);
    assert.equal(published.version.revision, 1);
    const draft = await service.saveDraft({ settings: [], expectedRevision: published.draft.revision }, user);
    await service.discardDraft(user, draft.revision);
    const restarted = await service.saveDraft({ settings: [] }, user);
    assert.equal(restarted.revision, 1);
    // The old implementation attempts to insert (store, 1) a second time here.
    const recovered = await service.publishDraft({ expectedRevision: restarted.revision }, user);
    assert.equal(recovered.version.revision, 2);
    assert.equal(recovered.draft.revision, 3);
    assert.deepEqual((await db.DesignDraftVersion.findAll({ order: [['revision', 'ASC']] })).map(row => row.revision), [1, 2]);
    await assert.rejects(service.publishDraft({ expectedRevision: restarted.revision }, user));
    assert.equal(await db.DesignDraftVersion.count(), 2);

    await db.Setting.create({ group: 'theme', key: 'primaryColor', value: '#live' });
    const discarded = await service.saveDraft({ settings: [{ group: 'theme', key: 'primaryColor', value: '#discarded' }] }, user);
    await service.discardDraft(user, discarded.revision);
    const archived = await db.DesignDraftArchive.findOne({ where: { revision: discarded.revision }, order: [['createdAt', 'DESC']] });
    assert.ok(archived);
    assert.deepEqual(archived.payload, [{ group: 'theme', key: 'primaryColor', operation: 'upsert', value: '#discarded' }]);

    const replacement = await service.saveDraft({ settings: [{ group: 'theme', key: 'primaryColor', value: '#replacement' }] }, user);
    const restored = await service.restoreArchivedDraft({ archiveId: archived.id, expectedRevision: replacement.revision }, user);
    assert.equal(restored.draft.revision, replacement.revision + 1);
    assert.equal(restored.draft.payload[0].value, '#discarded');
    assert.deepEqual((await db.DesignDraft.findOne()).baseSnapshot, { theme: { primaryColor: '#live' } });
    assert.equal(await db.DesignDraftArchive.count(), 3);
    assert.equal((await db.Setting.findOne({ where: { group: 'theme', key: 'primaryColor' } })).value, '#live');
    const beforePublishedRestore = await db.DesignDraft.findOne();
    await service.restorePublishedVersion({ versionId: published.version.id, expectedRevision: beforePublishedRestore.revision }, user);
    assert.equal(await db.DesignDraftArchive.count(), 4);
    assert.ok(await db.DesignDraftArchive.findOne({ where: { revision: beforePublishedRestore.revision, payload: beforePublishedRestore.payload } }));
    const metadata = await service.getArchivedDrafts();
    assert.ok(metadata.archives.every(row => !('payload' in row) && !('baseSnapshot' in row)));
    console.log('PASS: published history, draft archives and restores preserve replaced drafts without publishing restored payload.');
  } finally {
    AuditService.log = originalAudit;
    await db.sequelize.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
