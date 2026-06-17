'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('categories', 'banner_image', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('categories', 'custom_heading', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('categories', 'banner_image');
    await queryInterface.removeColumn('categories', 'custom_heading');
  },
};
