'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('enquiries', 'replies', {
      type: Sequelize.JSONB, allowNull: false, defaultValue: [],
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('enquiries', 'replies');
  },
};
