'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('order_items', 'variant_id', {
      type: Sequelize.UUID,
      allowNull: true,
      defaultValue: null,
      references: { model: 'product_variants', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'FK to product_variants — preserved even if variant is later deleted',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('order_items', 'variant_id');
  },
};
