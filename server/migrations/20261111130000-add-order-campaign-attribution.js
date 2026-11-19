'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'utm_source', { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.addColumn('orders', 'utm_medium', { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.addColumn('orders', 'utm_campaign', { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.addIndex('orders', ['utm_source', 'utm_medium', 'utm_campaign'], { name: 'orders_utm_attribution_idx' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('orders', 'orders_utm_attribution_idx');
    await queryInterface.removeColumn('orders', 'utm_campaign');
    await queryInterface.removeColumn('orders', 'utm_medium');
    await queryInterface.removeColumn('orders', 'utm_source');
  },
};
