'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tags', 'description', {
      type: Sequelize.TEXT,
      allowNull: false,
      defaultValue: '',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('tags', 'description');
  },
};
