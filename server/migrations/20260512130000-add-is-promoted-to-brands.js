'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('brands');
    if (!table.is_promoted) {
      await queryInterface.addColumn('brands', 'is_promoted', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    await queryInterface.addIndex('brands', ['is_promoted'], {
      name: 'idx_brands_is_promoted',
    }).catch(() => {});
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('brands', 'idx_brands_is_promoted').catch(() => {});
    const table = await queryInterface.describeTable('brands');
    if (table.is_promoted) {
      await queryInterface.removeColumn('brands', 'is_promoted');
    }
  },
};
