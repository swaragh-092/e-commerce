'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('page_visits', 'product_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await queryInterface.addColumn('page_visits', 'utm_source', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('page_visits', 'utm_medium', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('page_visits', 'utm_campaign', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addIndex('page_visits', ['product_id']);
    await queryInterface.addIndex('page_visits', ['utm_source']);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('page_visits', 'product_id');
    await queryInterface.removeColumn('page_visits', 'utm_source');
    await queryInterface.removeColumn('page_visits', 'utm_medium');
    await queryInterface.removeColumn('page_visits', 'utm_campaign');
  },
};
