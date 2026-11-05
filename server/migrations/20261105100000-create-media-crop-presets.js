'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.createTable('media_crop_presets', {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
        name: { type: Sequelize.STRING(60), allowNull: false },
        normalized_name: { type: Sequelize.STRING(60), allowNull: false },
        width: { type: Sequelize.INTEGER, allowNull: false },
        height: { type: Sequelize.INTEGER, allowNull: false },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await queryInterface.addIndex('media_crop_presets', ['normalized_name'], {
        name: 'idx_media_crop_presets_active_name', unique: true, where: { deleted_at: null }, transaction,
      });
      await queryInterface.sequelize.query('ALTER TABLE media_crop_presets ADD CONSTRAINT media_crop_presets_dimensions CHECK (width BETWEEN 1 AND 4096 AND height BETWEEN 1 AND 4096)', { transaction });
    });
  },
  async down(queryInterface) { await queryInterface.dropTable('media_crop_presets'); },
};
