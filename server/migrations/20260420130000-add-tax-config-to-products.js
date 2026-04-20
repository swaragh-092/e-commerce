'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('products', 'tax_config', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
      }, { transaction });

      // Migrate existing tax_rate data to tax_config
      // We convert the decimal rate to a percentage (e.g. 0.18 -> 18) for the new config
      await queryInterface.sequelize.query(
        `UPDATE products 
         SET tax_config = jsonb_build_object('flatRate', tax_rate * 100, 'isCustom', true) 
         WHERE tax_rate IS NOT NULL`,
        { transaction }
      );

      // Dropping the old tax_rate column as planned
      await queryInterface.removeColumn('products', 'tax_rate', { transaction });
      
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('products', 'tax_rate', {
        type: Sequelize.DECIMAL(6, 4),
        allowNull: true,
      }, { transaction });

      // Migrate data back from tax_config to tax_rate
      // Extract numeric rate and convert back to decimal factor (e.g. 18 -> 0.18)
      await queryInterface.sequelize.query(
        `UPDATE products 
         SET tax_rate = (tax_config->>'flatRate')::DECIMAL / 100 
         WHERE tax_config IS NOT NULL 
           AND tax_config->>'flatRate' IS NOT NULL 
           AND tax_config->>'flatRate' != ''
           AND tax_config->>'flatRate' ~ '^[0-9]+(\\.[0-9]+)?$'`,
        { transaction }
      );

      await queryInterface.removeColumn('products', 'tax_config', { transaction });
      
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
