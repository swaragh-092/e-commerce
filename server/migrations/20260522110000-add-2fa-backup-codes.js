'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'two_factor_backup_codes', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'two_factor_backup_codes');
  }
};
