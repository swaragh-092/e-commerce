'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE fulfillments ALTER COLUMN status SET DEFAULT 'pending'`
    );
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE fulfillments ALTER COLUMN status SET DEFAULT 'shipped'`
    );
  },
};
