'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('media', 'type', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: 'image',
    });

    await queryInterface.addIndex('media', ['type'], {
      name: 'idx_media_type',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('media', 'idx_media_type');
    await queryInterface.removeColumn('media', 'type');
  },
};
