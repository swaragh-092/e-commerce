'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'email_mfa_password_binding', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'email_mfa_password_binding');
  },
};
