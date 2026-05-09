'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addIndex('product_variants', ['media_id'], {
      name: 'idx_product_variants_media_id'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeIndex('product_variants', 'idx_product_variants_media_id');
  }
};
