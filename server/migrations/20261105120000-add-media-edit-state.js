'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('media', 'is_edited', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
  },
  async down(queryInterface) { await queryInterface.removeColumn('media', 'is_edited'); },
};
