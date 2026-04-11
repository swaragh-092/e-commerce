'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('coupons');
    const addColumnIfMissing = async (columnName, definition) => {
      if (!table[columnName]) {
        await queryInterface.addColumn('coupons', columnName, definition);
      }
    };

    await addColumnIfMissing('campaign_status', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'active',
    });
    await addColumnIfMissing('application_mode', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'manual',
    });
    await addColumnIfMissing('stacking_rules', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {
        allowOrderDiscounts: false,
        allowShippingDiscounts: true,
        allowMultipleCoupons: false,
      },
    });

    await queryInterface.sequelize.query(`
      UPDATE coupons
      SET campaign_status = CASE
        WHEN is_active = false THEN 'paused'
        ELSE 'active'
      END
      WHERE campaign_status IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE coupons
      SET application_mode = 'manual'
      WHERE application_mode IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE coupons
      SET stacking_rules = jsonb_build_object(
        'allowOrderDiscounts', false,
        'allowShippingDiscounts', true,
        'allowMultipleCoupons', false
      )
      WHERE stacking_rules IS NULL
    `);
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('coupons');
    const removeColumnIfPresent = async (columnName) => {
      if (table[columnName]) {
        await queryInterface.removeColumn('coupons', columnName);
      }
    };

    await removeColumnIfPresent('stacking_rules');
    await removeColumnIfPresent('application_mode');
    await removeColumnIfPresent('campaign_status');
  },
};
