'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'unit', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('products', 'unit');
  },
};
