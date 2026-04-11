'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('orders');
    if (!table.applied_discounts) {
      await queryInterface.addColumn('orders', 'applied_discounts', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('orders');
    if (table.applied_discounts) {
      await queryInterface.removeColumn('orders', 'applied_discounts');
    }
  },
};
