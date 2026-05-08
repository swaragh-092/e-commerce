'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('products');
    if (tableInfo.tax_rate) {
      await queryInterface.removeColumn('products', 'tax_rate');
      console.log('Successfully dropped legacy tax_rate column from products table.');
    } else {
      console.log('Legacy tax_rate column already dropped or not present.');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // This is a cleanup migration, we don't want to bring back dead columns in down()
    // but for completeness we could define the column again if needed.
    // However, since tax_config is the new standard, we leave this empty.
  }
};
