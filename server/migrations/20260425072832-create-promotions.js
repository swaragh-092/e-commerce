'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('promotions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      label: { type: Sequelize.STRING(100), allowNull: false },
      type: { type: Sequelize.STRING(30), defaultValue: 'sale' },
      badge_color: { type: Sequelize.STRING(30) },
      badge_icon: { type: Sequelize.STRING(50) },
      description: { type: Sequelize.TEXT },
      start_date: { type: Sequelize.DATE },
      end_date: { type: Sequelize.DATE },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      priority: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('promotions');
  }
};
