'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'avg_rating', {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: true,
      defaultValue: null,
      comment: 'Cached average rating (0.00–5.00) refreshed after each approved review',
    });
    await queryInterface.addColumn('products', 'review_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Cached count of approved reviews',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('products', 'avg_rating');
    await queryInterface.removeColumn('products', 'review_count');
  },
};
