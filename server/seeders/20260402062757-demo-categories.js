'use strict';
const { v4: uuidv4 } = require('uuid');

const electronicsId = uuidv4();
const clothingId = uuidv4();
const audioId = uuidv4();
const mensId = uuidv4();
const womensId = uuidv4();

const categories = [
  { id: electronicsId, name: 'Electronics', slug: 'electronics', parent_id: null, sort_order: 1, created_at: new Date(), updated_at: new Date() },
  { id: clothingId, name: 'Clothing', slug: 'clothing', parent_id: null, sort_order: 2, created_at: new Date(), updated_at: new Date() },
  { id: audioId, name: 'Audio', slug: 'audio', parent_id: electronicsId, sort_order: 3, created_at: new Date(), updated_at: new Date() },
  { id: mensId, name: 'Men\'s Clothing', slug: 'mens-clothing', parent_id: clothingId, sort_order: 4, created_at: new Date(), updated_at: new Date() },
  { id: womensId, name: 'Women\'s Clothing', slug: 'womens-clothing', parent_id: clothingId, sort_order: 5, created_at: new Date(), updated_at: new Date() }
];

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('categories', categories, {});
  },
  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('categories', null, {});
  }
};
