'use strict';
const crypto = require('crypto');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM shipping_providers WHERE code = 'shiprocket' LIMIT 1",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (existing) {
      return;
    }

    await queryInterface.bulkInsert('shipping_providers', [{
        id: crypto.randomUUID(),
        code: 'shiprocket',
        name: 'Shiprocket',
        type: 'aggregator',
        enabled: true,
        is_default: false,
        mode: 'api',
        supports_cod: true,
        supports_returns: true,
        supports_reverse_pickup: true,
        supports_heavy_items: true,
        supports_fragile_items: true,
        supported_regions: JSON.stringify([]),
        blocked_regions: JSON.stringify([]),
        settings: JSON.stringify({
            apiUrl: 'https://apiv2.shiprocket.in/v1/external',
            maxReturnDays: 7
        }),
        created_at: new Date(),
        updated_at: new Date(),
    }]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('shipping_providers', { code: 'shiprocket' }, {});
  }
};
