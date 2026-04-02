'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('settings', [
      {
        id: uuidv4(),
        key: 'primaryColor',
        value: JSON.stringify('#1976d2'),
        group: 'theme',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        key: 'storeName',
        value: JSON.stringify('My E-Commerce Store'),
        group: 'general',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        key: 'wishlistEnabled',
        value: JSON.stringify(true),
        group: 'features',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        key: 'reviewsEnabled',
        value: JSON.stringify(true),
        group: 'features',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('settings', null, {});
  }
};
