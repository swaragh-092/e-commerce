'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('shipments', 'planned_parcel_id', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('shipments', 'package_profile_id', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('shipments', 'package_name', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('shipments', 'package_name');
    await queryInterface.removeColumn('shipments', 'package_profile_id');
    await queryInterface.removeColumn('shipments', 'planned_parcel_id');
  },
};
