'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Drop existing chk_sale_price
    await queryInterface.sequelize.query('ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_sale_price');

    // 2. Add hardened chk_sale_price that considers the scheduling window
    // Now it enforces:
    // - sale_price < price (if sale_price set)
    // - sale_end_at > sale_start_at (if both set)
    // - sale_price CANNOT be NULL if either scheduling date is set (orphaned window)
    await queryInterface.sequelize.query(`
      ALTER TABLE products ADD CONSTRAINT chk_sale_price 
      CHECK (
        (sale_price IS NULL AND sale_start_at IS NULL AND sale_end_at IS NULL) OR 
        (sale_price IS NOT NULL AND sale_price < price AND (sale_start_at IS NULL OR sale_end_at IS NULL OR sale_end_at > sale_start_at))
      )
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_sale_price');
    
    // Restore legacy constraint
    await queryInterface.sequelize.query('ALTER TABLE products ADD CONSTRAINT chk_sale_price CHECK (sale_price IS NULL OR sale_price < price)');
  }
};
