'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('products', 'packing_mode', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'standard',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('products', 'packing_mode');
  },
};
