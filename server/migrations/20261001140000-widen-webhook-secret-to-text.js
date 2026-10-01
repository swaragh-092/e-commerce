'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('shipping_providers', 'webhook_secret', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('shipping_providers', 'webhook_secret', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },
};
