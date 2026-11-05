'use strict';
// Local-only integration probe. All fixture rows roll back; no media is changed.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { sequelize, CropPreset } = require('../../src/modules');
const service = require('../../src/modules/media/cropPreset.service');
async function main() {
  if ((process.env.NODE_ENV || 'development') !== 'development' || !['localhost', '127.0.0.1', '::1'].includes(sequelize.config.host)) {
    throw new Error('This probe only runs against a local development database.');
  }
  sequelize.options.logging = false;
  const transactionMethod = sequelize.transaction;
  const listMethod = CropPreset.findAll;
  const marker = `QA preset ${randomUUID()}`;
  const outer = await transactionMethod.call(sequelize);
  try {
    // Exercise real SQL and constraints inside one rollback-only test boundary.
    sequelize.transaction = callback => callback(outer);
    CropPreset.findAll = options => listMethod.call(CropPreset, { ...options, transaction: outer });
    const preset = await service.create({ name: marker, width: 800, height: 1000 });
    assert.equal(preset.ratio, 0.8);
    assert.ok((await service.list()).some(row => row.recordId === preset.recordId));
    const updated = await service.update(preset.recordId, { name: marker, width: 1920, height: 640 });
    assert.equal(updated.ratio, 3);
    await service.remove(preset.recordId);
    assert.equal((await service.list()).some(row => row.recordId === preset.recordId), false);
    const restored = await service.restore(preset.recordId);
    assert.equal(restored.recordId, preset.recordId);
    await assert.rejects(service.create({ name: marker.toUpperCase(), width: 100, height: 100 }), { code: 'CONFLICT' });
  } finally {
    sequelize.transaction = transactionMethod;
    CropPreset.findAll = listMethod;
    await outer.rollback();
  }
  assert.equal(await CropPreset.count({ where: { normalizedName: marker.toLowerCase() }, paranoid: false }), 0);
  console.log('PASS: PostgreSQL create/list/update/soft-delete/restore/name uniqueness; all test rows rolled back.');
}
main().catch(error => { console.error('FAIL:', error.message); process.exitCode = 1; }).finally(() => sequelize.close());
