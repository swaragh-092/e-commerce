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

    await addColumnIfMissing('name', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await addColumnIfMissing('description', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing('excluded_product_ids', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });
    await addColumnIfMissing('excluded_category_ids', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });
    await addColumnIfMissing('excluded_brand_ids', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });
    await addColumnIfMissing('exclude_sale_items', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing('visibility', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'private',
    });
    await addColumnIfMissing('customer_eligibility', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'all',
    });
    await addColumnIfMissing('is_exclusive', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing('priority', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.sequelize.query("UPDATE coupons SET name = code WHERE name IS NULL");
    await queryInterface.changeColumn('coupons', 'name', {
      type: Sequelize.STRING(255),
      allowNull: false,
    });

    await queryInterface.sequelize.query(
      "UPDATE coupons SET applicable_ids = '[]'::jsonb WHERE applicable_ids IS NULL"
    );

    await queryInterface.changeColumn('coupons', 'applicable_ids', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });

    await queryInterface.sequelize.query('ALTER TABLE coupons DROP CONSTRAINT IF EXISTS chk_coupon_value');
    await queryInterface.sequelize.query(`
      ALTER TABLE coupons
      ADD CONSTRAINT chk_coupon_value
      CHECK (
        (type = 'free_shipping' AND value = 0)
        OR (type IN ('percentage', 'fixed_amount') AND value > 0)
      )
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('ALTER TABLE coupons DROP CONSTRAINT IF EXISTS chk_coupon_value');
    await queryInterface.sequelize.query('ALTER TABLE coupons ADD CONSTRAINT chk_coupon_value CHECK (value > 0)');

    const table = await queryInterface.describeTable('coupons');

    if (table.applicable_ids) {
      await queryInterface.changeColumn('coupons', 'applicable_ids', {
        type: Sequelize.JSONB,
        allowNull: true,
      });
    }

    const removeColumnIfPresent = async (columnName) => {
      if (table[columnName]) {
        await queryInterface.removeColumn('coupons', columnName);
      }
    };

    await removeColumnIfPresent('priority');
    await removeColumnIfPresent('is_exclusive');
    await removeColumnIfPresent('customer_eligibility');
    await removeColumnIfPresent('visibility');
    await removeColumnIfPresent('exclude_sale_items');
    await removeColumnIfPresent('excluded_brand_ids');
    await removeColumnIfPresent('excluded_category_ids');
    await removeColumnIfPresent('excluded_product_ids');
    await removeColumnIfPresent('description');
    await removeColumnIfPresent('name');
  },
};
