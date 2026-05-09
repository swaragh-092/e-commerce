'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('menus', 'alignment', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'left',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('menus', 'alignment');
  },
};
