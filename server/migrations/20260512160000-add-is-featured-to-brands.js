'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('brands');
    if (!table.is_featured) {
      await queryInterface.addColumn('brands', 'is_featured', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
    }

    await queryInterface.addIndex('brands', ['is_featured'], {
      name: 'idx_brands_is_featured',
    }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('brands', 'idx_brands_is_featured').catch(() => {});
    const table = await queryInterface.describeTable('brands');
    if (table.is_featured) {
      await queryInterface.removeColumn('brands', 'is_featured');
    }
  },
};
