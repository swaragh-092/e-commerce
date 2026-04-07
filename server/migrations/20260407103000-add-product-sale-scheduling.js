'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'sale_start_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('products', 'sale_end_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('products', 'sale_label', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('products', 'sale_label');
    await queryInterface.removeColumn('products', 'sale_end_at');
    await queryInterface.removeColumn('products', 'sale_start_at');
  },
};
