'use strict';

const addColumnIfMissing = async (queryInterface, table, column, definition) => {
  const tableDefinition = await queryInterface.describeTable(table);
  if (!tableDefinition[column]) {
    await queryInterface.addColumn(table, column, definition);
  }
};

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await addColumnIfMissing(queryInterface, 'shipments', 'expected_delivery_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, 'shipments', 'expected_delivery_history', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('shipments', 'expected_delivery_history');
    await queryInterface.removeColumn('shipments', 'expected_delivery_date');
  },
};
