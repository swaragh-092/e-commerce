'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const db = require('../../src/modules');
const AuditService = require('../../src/modules/audit/audit.service');
const service = require('../../src/modules/settings/designDraft.service');
const versionMigration = require('../../migrations/20260923110000-create-design-draft-versions');

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
    console.log('PASS: publish, discard, recreate and publish preserves unique history revisions.');
  } finally {
    AuditService.log = originalAudit;
    await db.sequelize.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
