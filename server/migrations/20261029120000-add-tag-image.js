'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn('tags', 'image_id', {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'media', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE',
      }, { transaction });
      await queryInterface.addIndex('tags', ['image_id'], { name: 'tags_image_id', transaction });
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('tags', 'image_id');
  },
};
