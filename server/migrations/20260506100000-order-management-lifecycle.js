'use strict';

const addColumnIfMissing = async (queryInterface, table, column, definition) => {
    const tableDefinition = await queryInterface.describeTable(table);
    if (!tableDefinition[column]) {
        await queryInterface.addColumn(table, column, definition);
    }
};

const addIndexSafe = async (queryInterface, table, fields, options) => {
    try {
        await queryInterface.addIndex(table, fields, options);
    } catch (err) {
        if (!/already exists/i.test(err.message)) throw err;
    }
};

module.exports = {
    async up(queryInterface, Sequelize) {
        await addColumnIfMissing(queryInterface, 'orders', 'order_shipping_status', {
            type: Sequelize.STRING(50),
            allowNull: false,
            defaultValue: 'not_shipped',
        });
        await addColumnIfMissing(queryInterface, 'orders', 'put_back_status', {
            type: Sequelize.STRING(50),
            allowNull: true,
        });
        await addColumnIfMissing(queryInterface, 'orders', 'put_back_processing_status', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        });

        await queryInterface.sequelize.query(`
            UPDATE orders
            SET status = CASE status
                WHEN 'pending_payment' THEN 'confirmed'
                WHEN 'pending_cod' THEN 'confirmed'
                WHEN 'paid' THEN 'processing'
                WHEN 'partially_shipped' THEN 'processing'
                WHEN 'shipped' THEN 'ready_for_shipment'
                WHEN 'delivered' THEN 'closed'
                WHEN 'refunded' THEN 'closed'
                ELSE COALESCE(status, 'confirmed')
            END
        `);

        await queryInterface.sequelize.query(`
            UPDATE orders
            SET order_shipping_status = CASE shipment_status
                WHEN 'partially_shipped' THEN 'partially_shipped'
                WHEN 'shipped' THEN 'shipped'
                WHEN 'delivered' THEN 'delivered'
                ELSE COALESCE(order_shipping_status, 'not_shipped')
            END
        `);

        await queryInterface.sequelize.query(`
            UPDATE payments
            SET status = CASE
                WHEN provider = 'cod' AND status = 'pending' THEN 'pending_cod'
                WHEN status = 'pending' THEN 'payment_pending'
                WHEN status = 'completed' THEN 'paid_online'
                WHEN status = 'cod_collected' THEN 'paid_cod'
                WHEN status = 'failed' THEN 'payment_failed'
                ELSE status
            END
        `);

        await queryInterface.changeColumn('payments', 'status', {
            type: Sequelize.STRING(60),
            allowNull: false,
            defaultValue: 'payment_pending',
        });

        await queryInterface.sequelize.query(`
            UPDATE shipments
            SET status = CASE status
                WHEN 'pending' THEN 'created'
                ELSE COALESCE(status, 'created')
            END
        `);
        await queryInterface.changeColumn('shipments', 'status', {
            type: Sequelize.STRING(50),
            allowNull: false,
            defaultValue: 'created',
        });

        await queryInterface.createTable('order_returns', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            order_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'orders', key: 'id' }, onDelete: 'CASCADE' },
            requested_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
            type: { type: Sequelize.STRING(20), allowNull: false },
            status: { type: Sequelize.STRING(60), allowNull: false },
            reason: { type: Sequelize.TEXT },
            resolution_notes: { type: Sequelize.TEXT },
            metadata: { type: Sequelize.JSONB, defaultValue: {} },
            approved_at: { type: Sequelize.DATE },
            rejected_at: { type: Sequelize.DATE },
            completed_at: { type: Sequelize.DATE },
            deleted_at: { type: Sequelize.DATE },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.createTable('order_return_items', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            return_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'order_returns', key: 'id' }, onDelete: 'CASCADE' },
            order_item_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'order_items', key: 'id' }, onDelete: 'CASCADE' },
            shipment_item_id: { type: Sequelize.UUID, references: { model: 'shipment_items', key: 'id' }, onDelete: 'SET NULL' },
            quantity: { type: Sequelize.INTEGER, allowNull: false },
            reason: { type: Sequelize.TEXT },
            metadata: { type: Sequelize.JSONB, defaultValue: {} },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.createTable('order_refunds', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            order_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'orders', key: 'id' }, onDelete: 'CASCADE' },
            return_id: { type: Sequelize.UUID, references: { model: 'order_returns', key: 'id' }, onDelete: 'SET NULL' },
            payment_id: { type: Sequelize.UUID, references: { model: 'payments', key: 'id' }, onDelete: 'SET NULL' },
            amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
            currency: { type: Sequelize.STRING(10), defaultValue: 'INR' },
            status: { type: Sequelize.STRING(60), allowNull: false, defaultValue: 'refund_initiated' },
            provider_refund_id: { type: Sequelize.STRING(255) },
            reason: { type: Sequelize.TEXT },
            metadata: { type: Sequelize.JSONB, defaultValue: {} },
            processed_at: { type: Sequelize.DATE },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.createTable('order_status_history', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            order_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'orders', key: 'id' }, onDelete: 'CASCADE' },
            entity_type: { type: Sequelize.STRING(40), allowNull: false },
            entity_id: { type: Sequelize.UUID },
            status_group: { type: Sequelize.STRING(40), allowNull: false },
            from_status: { type: Sequelize.STRING(60) },
            to_status: { type: Sequelize.STRING(60), allowNull: false },
            metadata: { type: Sequelize.JSONB, defaultValue: {} },
            changed_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.sequelize.query('ALTER TABLE order_return_items ADD CONSTRAINT chk_return_items_qty CHECK (quantity > 0)');
        await queryInterface.sequelize.query('ALTER TABLE order_refunds ADD CONSTRAINT chk_order_refunds_amount CHECK (amount > 0)');

        await addIndexSafe(queryInterface, 'orders', ['order_shipping_status'], { name: 'idx_orders_order_shipping_status' });
        await addIndexSafe(queryInterface, 'orders', ['put_back_processing_status'], { name: 'idx_orders_put_back_processing' });
        await addIndexSafe(queryInterface, 'order_returns', ['order_id', 'status'], { name: 'idx_order_returns_order_status' });
        await addIndexSafe(queryInterface, 'order_return_items', ['return_id'], { name: 'idx_order_return_items_return' });
        await addIndexSafe(queryInterface, 'order_return_items', ['order_item_id'], { name: 'idx_order_return_items_order_item' });
        await addIndexSafe(queryInterface, 'order_refunds', ['order_id', 'status'], { name: 'idx_order_refunds_order_status' });
        await addIndexSafe(queryInterface, 'order_status_history', ['order_id', 'created_at'], { name: 'idx_order_status_history_order_created' });

        await queryInterface.sequelize.query(`
            UPDATE orders o
            SET status = CASE
                WHEN EXISTS (SELECT 1 FROM shipments s WHERE s.order_id = o.id) THEN 'ready_for_shipment'
                ELSE 'processing'
            END
            WHERE o.status = 'closed'
              AND (
                NOT EXISTS (
                    SELECT 1 FROM payments p
                    WHERE p.order_id = o.id
                      AND p.status IN ('paid_online', 'paid_cod')
                )
                OR NOT EXISTS (
                    SELECT 1 FROM shipments s
                    WHERE s.order_id = o.id
                      AND s.status IN ('delivered', 'rto')
                )
              )
        `);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('order_status_history');
        await queryInterface.dropTable('order_refunds');
        await queryInterface.dropTable('order_return_items');
        await queryInterface.dropTable('order_returns');
        await queryInterface.removeColumn('orders', 'put_back_processing_status');
        await queryInterface.removeColumn('orders', 'put_back_status');
        await queryInterface.removeColumn('orders', 'order_shipping_status');
    },
};
