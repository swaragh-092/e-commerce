'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM shipping_providers WHERE code = 'ekart' LIMIT 1",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (existing) {
      return;
    }

    const ekartId = uuidv4();
    await queryInterface.bulkInsert('shipping_providers', [{
      id: ekartId,
      code: 'ekart',
      name: 'Ekart Logistics',
      is_default: false,
      supports_cod: true,
      enabled: false, // Disabled by default, admin must configure & enable
      settings: JSON.stringify({ apiUrl: 'https://api.ekartlogistics.com/v1' }),
      created_at: new Date(),
      updated_at: new Date()
    }], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('shipping_providers', { code: 'ekart' }, {});
  }
};
