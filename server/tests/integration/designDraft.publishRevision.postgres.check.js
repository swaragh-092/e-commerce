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
    const archivesAfterPublishedRestore = await db.DesignDraftArchive.findAll();
    assert.ok(archivesAfterPublishedRestore.some(row => row.revision === beforePublishedRestore.revision && JSON.stringify(row.payload) === JSON.stringify(beforePublishedRestore.payload)));
    const metadata = await service.getArchivedDrafts();
    assert.ok(metadata.archives.every(row => !('payload' in row) && !('baseSnapshot' in row)));

    const productRows = [
      { id: 'picks', type: 'product-row', source: 'staffPicks', pagePosition: 'below',
        productIds: [randomUUID(), randomUUID()] },
      { id: 'faq', type: 'faq', pagePosition: 'below', items: [
        { title: 'When will it ship?', text: 'Within two business days.' },
        { title: 'Can I collect it?', text: 'Yes, at the store.' },
      ] },
    ];
    const sectionSetting = { group: 'productPage', key: 'productRows' };
    const savedLayout = await service.saveDraft({
      settings: [{ ...sectionSetting, value: productRows }],
      expectedRevision: (await service.getDraft()).draft.revision,
    }, user);
    const { draft: reopened } = await service.getDraft();
    assert.equal(reopened.revision, savedLayout.revision);
    assert.deepEqual(reopened.payload, [{ ...sectionSetting, operation: 'upsert', value: productRows }]);
    assert.equal(await db.Setting.findOne({ where: sectionSetting }), null);
    await service.publishDraft({ expectedRevision: reopened.revision }, user);
    assert.deepEqual((await db.Setting.findOne({ where: sectionSetting })).value, productRows);
    console.log('PASS: reopening and publishing preserves Staff Picks and both FAQ items in order.');

    for (const [group, assignmentKey] of [
      ['productPage', 'productSlugs'],
      ['categoryPage', 'categorySlugs'],
    ]) {
      const alternateSetting = { group, key: 'alternateTemplates' };
      const alternateTemplates = [{
        id: randomUUID(),
        name: 'Seeds',
        [assignmentKey]: ['basil-seeds'],
        settings: { productRows: [{
          id: 'care', type: 'faq', items: [{ title: 'How deep should I sow?', text: 'Sow just below the surface.' }],
        }] },
      }];
      const defaultSetting = { ...sectionSetting, group };
      if (group === 'categoryPage') await db.Setting.create({ ...defaultSetting, value: productRows });
      const publishedLayout = await db.DesignDraft.findOne();
      await service.saveDraft({
        settings: [{ ...alternateSetting, value: alternateTemplates }],
        expectedRevision: publishedLayout.revision,
      }, user);
      const { draft: alternateDraft } = await service.getDraft();
      assert.deepEqual(alternateDraft.payload[0].value, alternateTemplates);
      assert.equal(await db.Setting.findOne({ where: alternateSetting }), null);
      await service.publishDraft({ expectedRevision: alternateDraft.revision }, user);
      assert.deepEqual((await db.Setting.findOne({ where: alternateSetting })).value, alternateTemplates);
      assert.deepEqual((await db.Setting.findOne({ where: defaultSetting })).value, productRows);
      console.log(`PASS: publishing the assigned Seeds template preserves the default layout for ${group}.`);
    }
    console.log('PASS: published history, draft archives and restores preserve replaced drafts without publishing restored payload.');
  } finally {
    AuditService.log = originalAudit;
    await db.sequelize.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
