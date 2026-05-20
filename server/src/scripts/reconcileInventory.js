'use strict';

const { sequelize } = require('../modules');

const run = async () => {
  const transaction = await sequelize.transaction();
  try {
    const [variantClampRows] = await sequelize.query(`
      UPDATE product_variants
      SET
        stock_qty = GREATEST(COALESCE(stock_qty, 0), 0),
        reserved_qty = GREATEST(
          LEAST(COALESCE(reserved_qty, 0), GREATEST(COALESCE(stock_qty, 0), 0)),
          0
        )
      WHERE
        COALESCE(stock_qty, 0) < 0
        OR COALESCE(reserved_qty, 0) < 0
        OR COALESCE(reserved_qty, 0) > GREATEST(COALESCE(stock_qty, 0), 0)
      RETURNING id
    `, { transaction });

    const [simpleClampRows] = await sequelize.query(`
      UPDATE products
      SET
        quantity = GREATEST(COALESCE(quantity, 0), 0),
        reserved_qty = GREATEST(
          LEAST(COALESCE(reserved_qty, 0), GREATEST(COALESCE(quantity, 0), 0)),
          0
        )
      WHERE
        type <> 'variable'
        AND (
          COALESCE(quantity, 0) < 0
          OR COALESCE(reserved_qty, 0) < 0
          OR COALESCE(reserved_qty, 0) > GREATEST(COALESCE(quantity, 0), 0)
        )
      RETURNING id
    `, { transaction });

    const [variableSyncRows] = await sequelize.query(`
      UPDATE products p
      SET
        quantity = GREATEST(v.total_stock, v.total_reserved),
        reserved_qty = v.total_reserved
      FROM (
        SELECT
          product_id,
          COALESCE(SUM(stock_qty), 0)::integer AS total_stock,
          COALESCE(SUM(reserved_qty), 0)::integer AS total_reserved
        FROM product_variants
        WHERE deleted_at IS NULL AND is_active = true
        GROUP BY product_id
      ) v
      WHERE
        p.id = v.product_id
        AND p.type = 'variable'
        AND (
          COALESCE(p.quantity, 0) <> GREATEST(v.total_stock, v.total_reserved)
          OR COALESCE(p.reserved_qty, 0) <> v.total_reserved
        )
      RETURNING p.id
    `, { transaction });

    await transaction.commit();

    console.log('Inventory reconciliation completed.');
    console.log(`Variants clamped: ${variantClampRows.length}`);
    console.log(`Simple products clamped: ${simpleClampRows.length}`);
    console.log(`Variable products synced: ${variableSyncRows.length}`);
    process.exit(0);
  } catch (error) {
    await transaction.rollback();
    console.error('Inventory reconciliation failed:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

run();

