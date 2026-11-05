'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('menu_items', 'child_display_limit', {
      type: Sequelize.INTEGER, allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('menu_items', 'child_display_limit');
  },
};
