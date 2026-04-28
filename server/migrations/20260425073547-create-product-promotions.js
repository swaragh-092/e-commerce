'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('product_promotions', {
      product_id: { type: Sequelize.UUID, primaryKey: true, references: { model: 'products', key: 'id' }, onDelete: 'CASCADE' },
      promotion_id: { type: Sequelize.UUID, primaryKey: true, references: { model: 'promotions', key: 'id' }, onDelete: 'CASCADE' },
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('product_promotions');
  }
};
