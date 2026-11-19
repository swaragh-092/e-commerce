'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('enquiries', 'utm_source', { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.addColumn('enquiries', 'utm_medium', { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.addColumn('enquiries', 'utm_campaign', { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.addIndex('enquiries', ['utm_source', 'utm_medium', 'utm_campaign'], { name: 'enquiries_utm_attribution_idx' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('enquiries', 'enquiries_utm_attribution_idx');
    await queryInterface.removeColumn('enquiries', 'utm_campaign');
    await queryInterface.removeColumn('enquiries', 'utm_medium');
    await queryInterface.removeColumn('enquiries', 'utm_source');
  },
};
