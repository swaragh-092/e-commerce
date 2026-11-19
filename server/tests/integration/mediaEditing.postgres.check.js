'use strict';
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const sharp = require('sharp');
const { sequelize, Media } = require('../../src/modules');
const storage = require('../../src/utils/storage').getStorageProvider();
const editing = require('../../src/modules/media/mediaEditing.service');
async function main() {
  if ((process.env.NODE_ENV || 'development') !== 'development' || !['localhost', '127.0.0.1', '::1'].includes(sequelize.config.host)) throw new Error('Local development database only.');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'media-edit-probe-'));
  const previousDirectory = process.env.UPLOAD_DIR;
  process.env.UPLOAD_DIR = directory;
  sequelize.options.logging = false;
  let fixture;
  try {
    await storage.ensureDirs();
    const original = await sharp({ create: { width: 48, height: 32, channels: 3, background: 'red' } }).jpeg().toBuffer();
    const crop = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'green' } }).webp().toBuffer();
    fixture = await Media.create({ filename: 'probe.jpg', url: '/uploads/probe.jpg', mimeType: 'image/jpeg', originalName: 'Original.jpg', size: original.length, type: 'image', provider: 'local' });
    await storage.save(original, fixture.filename);
    // Actual PostgreSQL row locks serialize competing saves of the same image.
    await Promise.all([editing.replace(fixture.id, { buffer: crop }), editing.replace(fixture.id, { buffer: crop })]);
    let current = await Media.findByPk(fixture.id);
    assert.equal(current.url, fixture.url);
    assert.equal(current.originalName, 'Original.jpg');
    assert.equal(current.isEdited, true);
    assert.deepEqual(await storage.readOriginal(fixture.filename), original);
    assert.equal((await sharp(await storage.read(fixture.filename)).metadata()).format, 'jpeg');
    await editing.revert(fixture.id);
    current = await Media.findByPk(fixture.id);
    assert.equal(current.isEdited, false);
    assert.deepEqual(await storage.read(fixture.filename), original);
    console.log('PASS: real database concurrent edits, stable identity/URL/name/format, and exact original restoration.');
  } finally {
    if (fixture) await fixture.destroy();
    if (previousDirectory === undefined) delete process.env.UPLOAD_DIR; else process.env.UPLOAD_DIR = previousDirectory;
    await rm(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error('FAIL:', error.message); process.exitCode = 1; }).finally(() => sequelize.close());
