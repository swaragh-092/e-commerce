'use strict';
const { CropPreset } = require('../index');
const AppError = require('../../utils/AppError');
const MAX_PRESETS = 50;
const serialize = (preset) => ({ id: `custom:${preset.id}`, recordId: preset.id, label: preset.name, width: preset.width, height: preset.height, ratio: preset.width / preset.height, custom: true });
const mutation = async (action) => {
  try {
    return await CropPreset.sequelize.transaction(async transaction => {
      // Serialize the store-wide count check and restores across server processes.
      await CropPreset.sequelize.query('SELECT pg_advisory_xact_lock(583106551)', { transaction });
      return action(transaction);
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') throw new AppError('CONFLICT', 409, 'A crop preset with this name already exists. Choose a different name.');
    throw error;
  }
};
const assertCapacity = async transaction => {
  if (await CropPreset.count({ transaction }) >= MAX_PRESETS) throw new AppError('CONFLICT', 409, 'You can save up to 50 custom presets. Remove an unused preset first.');
};
const values = (data) => ({ name: data.name.trim(), normalizedName: data.name.trim().toLowerCase(), width: data.width, height: data.height });
exports.list = async () => (await CropPreset.findAll({ order: [['name', 'ASC']], limit: MAX_PRESETS })).map(serialize);
exports.create = async data => mutation(async transaction => {
  await assertCapacity(transaction);
  return serialize(await CropPreset.create(values(data), { transaction }));
});
exports.update = async (id, data) => mutation(async transaction => {
  const preset = await CropPreset.findByPk(id, { transaction });
  if (!preset) throw new AppError('NOT_FOUND', 404, 'Crop preset not found. Refresh the presets and try again.');
  await preset.update(values(data), { transaction });
  return serialize(preset);
});
exports.remove = async id => mutation(async transaction => {
  const preset = await CropPreset.findByPk(id, { transaction });
  if (!preset) throw new AppError('NOT_FOUND', 404, 'Crop preset not found.');
  await preset.destroy({ transaction }); // Soft deletion; restore remains available.
  return serialize(preset);
});
exports.restore = async id => mutation(async transaction => {
  const preset = await CropPreset.findByPk(id, { paranoid: false, transaction });
  if (!preset) throw new AppError('NOT_FOUND', 404, 'Crop preset not found.');
  if (preset.deletedAt) {
    await assertCapacity(transaction);
    await preset.restore({ transaction });
  }
  return serialize(preset);
});
