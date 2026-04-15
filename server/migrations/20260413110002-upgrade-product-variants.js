'use strict';

/**
 * Upgrade product_variants:
 *   ADD:  price, stock_qty, is_active, sort_order
 *   DROP: name, value, price_modifier (quantity → renamed to stock_qty via copy+drop)
 *
 * Data migration:
 *   - Existing name/value rows are migrated into attribute_templates + attribute_values
 *     and then linked via variant_options so no data is lost.
 *   - price is seeded from the parent product's price (best safe default).
 *   - stock_qty is seeded from the old quantity column.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        // ── Step 1: Add new columns (nullable first so existing rows are valid) ──
        await queryInterface.addColumn('product_variants', 'price', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: true, // will backfill then set NOT NULL at the end
        });

        await queryInterface.addColumn('product_variants', 'stock_qty', {
            type: Sequelize.INTEGER,
            allowNull: true,
        });

        await queryInterface.addColumn('product_variants', 'is_active', {
            type: Sequelize.BOOLEAN,
            defaultValue: true,
            allowNull: false,
        });

        await queryInterface.addColumn('product_variants', 'sort_order', {
            type: Sequelize.INTEGER,
            defaultValue: 0,
            allowNull: false,
        });

        // ── Step 2: Data migration — backfill new columns from legacy data ──

        // stock_qty ← old quantity
        await queryInterface.sequelize.query(
            `UPDATE product_variants SET stock_qty = COALESCE(quantity, 0)`
        );

        // price ← parent product price (safe fallback; admin corrects per-variant later)
        await queryInterface.sequelize.query(
            `UPDATE product_variants pv
             SET price = p.price
             FROM products p
             WHERE pv.product_id = p.id AND pv.deleted_at IS NULL`
        );

        // For soft-deleted variants, use 0 as a safe sentinel
        await queryInterface.sequelize.query(
            `UPDATE product_variants SET price = 0 WHERE price IS NULL`
        );

        // ── Step 3: Migrate legacy name/value into attribute_templates + variant_options ──

        // 3a. Find distinct attribute names not already in attribute_templates
        await queryInterface.sequelize.query(`
            INSERT INTO attribute_templates (id, name, slug, sort_order, created_at, updated_at)
            SELECT gen_random_uuid(),
                   name,
                   lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')),
                   0,
                   NOW(),
                   NOW()
            FROM (SELECT DISTINCT name FROM product_variants WHERE name IS NOT NULL AND deleted_at IS NULL) AS distinct_names
            WHERE NOT EXISTS (
                SELECT 1 FROM attribute_templates at WHERE at.name = distinct_names.name
            )
        `);

        // 3b. Find distinct values not already in attribute_values for those attrs
        await queryInterface.sequelize.query(`
            INSERT INTO attribute_values (id, attribute_id, value, slug, created_at)
            SELECT gen_random_uuid(),
                   at.id,
                   pv_distinct.val,
                   lower(regexp_replace(pv_distinct.val, '[^a-zA-Z0-9]+', '-', 'g')),
                   NOW()
            FROM (
                SELECT DISTINCT name, value AS val
                FROM product_variants
                WHERE name IS NOT NULL AND value IS NOT NULL AND deleted_at IS NULL
            ) AS pv_distinct
            JOIN attribute_templates at ON at.name = pv_distinct.name
            WHERE NOT EXISTS (
                SELECT 1
                FROM attribute_values av
                WHERE av.attribute_id = at.id AND av.value = pv_distinct.val
            )
        `);

        // 3c. Populate variant_options from legacy name+value pairs
        await queryInterface.sequelize.query(`
            INSERT INTO variant_options (variant_id, attribute_id, value_id)
            SELECT pv.id,
                   at.id,
                   av.id
            FROM product_variants pv
            JOIN attribute_templates at ON at.name = pv.name
            JOIN attribute_values av    ON av.attribute_id = at.id AND av.value = pv.value
            WHERE pv.name IS NOT NULL AND pv.value IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM variant_options vo
                  WHERE vo.variant_id = pv.id AND vo.attribute_id = at.id
              )
        `);

        // ── Step 4: Set NOT NULL constraints now that backfill is done ──
        await queryInterface.changeColumn('product_variants', 'price', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false,
        });

        await queryInterface.changeColumn('product_variants', 'stock_qty', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
        });

        // ── Step 5: Remove the old quantity CHECK constraint if it exists ──
        // (best-effort — ignore if the constraint name differs across environments)
        try {
            await queryInterface.sequelize.query(
                `ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS chk_variant_qty`
            );
        } catch (_) { /* non-fatal */ }

        // Add fresh CHECK for stock_qty
        await queryInterface.sequelize.query(
            `ALTER TABLE product_variants ADD CONSTRAINT chk_variant_stock_qty CHECK (stock_qty >= 0)`
        );

        // ── Step 6: Drop the stale columns ──
        await queryInterface.removeColumn('product_variants', 'name');
        await queryInterface.removeColumn('product_variants', 'value');
        await queryInterface.removeColumn('product_variants', 'price_modifier');
        await queryInterface.removeColumn('product_variants', 'quantity');

        // ── Step 7: Add unique constraint on SKU (non-null values only) ──
        await queryInterface.addIndex('product_variants', ['sku'], {
            name: 'idx_variants_sku_unique',
            unique: true,
            where: { sku: { [Sequelize.Op.ne]: null } },
        });

        await queryInterface.addIndex('product_variants', ['product_id', 'is_active'], {
            name: 'idx_variants_product_active',
        });
    },

    async down(queryInterface, Sequelize) {
        // Restore columns
        await queryInterface.addColumn('product_variants', 'name', {
            type: Sequelize.STRING(100),
            allowNull: true,
        });
        await queryInterface.addColumn('product_variants', 'value', {
            type: Sequelize.STRING(100),
            allowNull: true,
        });
        await queryInterface.addColumn('product_variants', 'price_modifier', {
            type: Sequelize.DECIMAL(10, 2),
            defaultValue: 0,
        });
        await queryInterface.addColumn('product_variants', 'quantity', {
            type: Sequelize.INTEGER,
            defaultValue: 0,
        });

        // Best-effort restore from variant_options (partial; single-attribute variants only)
        await queryInterface.sequelize.query(`
            UPDATE product_variants pv
            SET name  = at.name,
                value = av.value,
                quantity = pv.stock_qty
            FROM variant_options vo
            JOIN attribute_templates at ON at.id = vo.attribute_id
            JOIN attribute_values    av ON av.id = vo.value_id
            WHERE vo.variant_id = pv.id
        `);

        // Remove new columns
        await queryInterface.removeColumn('product_variants', 'price');
        await queryInterface.removeColumn('product_variants', 'stock_qty');
        await queryInterface.removeColumn('product_variants', 'is_active');
        await queryInterface.removeColumn('product_variants', 'sort_order');

        await queryInterface.removeIndex('product_variants', 'idx_variants_sku_unique');
        await queryInterface.removeIndex('product_variants', 'idx_variants_product_active');
    },
};
