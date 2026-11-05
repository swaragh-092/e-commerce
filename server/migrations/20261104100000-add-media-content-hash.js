'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn('media', 'content_hash', {
        type: Sequelize.STRING(64), allowNull: true,
      }, { transaction });
      // Non-unique: admins may explicitly choose to upload another copy.
      await queryInterface.addIndex('media', ['content_hash', 'type'], {
        name: 'idx_media_content_hash_type', transaction,
      });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex('media', 'idx_media_content_hash_type', { transaction });
      await queryInterface.removeColumn('media', 'content_hash', { transaction });
    });
  },
};
