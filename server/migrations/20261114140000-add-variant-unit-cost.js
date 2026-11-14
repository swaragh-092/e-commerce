'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('product_variants', 'cost_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('product_variants', 'cost_price');
  },
};
