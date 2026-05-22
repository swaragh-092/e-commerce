'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('refresh_tokens', 'user_agent', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn('refresh_tokens', 'device_name', { type: Sequelize.STRING(200), allowNull: true });
    await queryInterface.addColumn('refresh_tokens', 'last_active_at', { type: Sequelize.DATE, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('refresh_tokens', 'last_active_at');
    await queryInterface.removeColumn('refresh_tokens', 'device_name');
    await queryInterface.removeColumn('refresh_tokens', 'user_agent');
  }
};
