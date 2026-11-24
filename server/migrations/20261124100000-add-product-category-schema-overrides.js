'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const table of ['products', 'categories']) {
        await queryInterface.addColumn(table, 'schema_override', {
          type: Sequelize.TEXT,
          allowNull: true,
        }, { transaction });
      }
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const table of ['products', 'categories']) {
        await queryInterface.removeColumn(table, 'schema_override', { transaction });
      }
    });
  },
};
