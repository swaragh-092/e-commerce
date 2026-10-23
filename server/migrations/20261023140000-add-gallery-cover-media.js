'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn('galleries', 'cover_media_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'media', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      }, { transaction });
      await queryInterface.addIndex('galleries', ['cover_media_id'], {
        name: 'galleries_cover_media_id_idx', transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('galleries', 'cover_media_id');
  },
};
