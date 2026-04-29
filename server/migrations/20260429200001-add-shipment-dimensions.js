'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('shipments', 'length_cm', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('shipments', 'breadth_cm', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('shipments', 'height_cm', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('shipments', 'actual_weight_grams', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('shipments', 'volumetric_weight_grams', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('shipments', 'length_cm');
    await queryInterface.removeColumn('shipments', 'breadth_cm');
    await queryInterface.removeColumn('shipments', 'height_cm');
    await queryInterface.removeColumn('shipments', 'actual_weight_grams');
    await queryInterface.removeColumn('shipments', 'volumetric_weight_grams');
  }
};
