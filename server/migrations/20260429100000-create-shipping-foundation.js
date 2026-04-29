'use strict';
const crypto = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('shipping_providers', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
            name: { type: Sequelize.STRING(100), allowNull: false },
            type: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'manual' },
            enabled: { type: Sequelize.BOOLEAN, defaultValue: true },
            is_default: { type: Sequelize.BOOLEAN, defaultValue: false },
            mode: { type: Sequelize.STRING(50), defaultValue: 'manual' },
            supports_cod: { type: Sequelize.BOOLEAN, defaultValue: true },
            supports_returns: { type: Sequelize.BOOLEAN, defaultValue: false },
            supports_reverse_pickup: { type: Sequelize.BOOLEAN, defaultValue: false },
            supports_heavy_items: { type: Sequelize.BOOLEAN, defaultValue: true },
            supports_fragile_items: { type: Sequelize.BOOLEAN, defaultValue: true },
            max_weight_kg: { type: Sequelize.DECIMAL(10, 3) },
            max_length_cm: { type: Sequelize.DECIMAL(10, 2) },
            max_breadth_cm: { type: Sequelize.DECIMAL(10, 2) },
            max_height_cm: { type: Sequelize.DECIMAL(10, 2) },
            supported_regions: { type: Sequelize.JSONB, defaultValue: [] },
            blocked_regions: { type: Sequelize.JSONB, defaultValue: [] },
            credentials_encrypted: { type: Sequelize.TEXT },
            settings: { type: Sequelize.JSONB, defaultValue: {} },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.createTable('shipping_quotes', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
            address_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'addresses', key: 'id' }, onDelete: 'RESTRICT' },
            provider_id: { type: Sequelize.UUID, references: { model: 'shipping_providers', key: 'id' }, onDelete: 'SET NULL' },
            rule_id: { type: Sequelize.UUID },
            serviceable: { type: Sequelize.BOOLEAN, defaultValue: false },
            shipping_cost: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
            currency: { type: Sequelize.STRING(10), defaultValue: 'INR' },
            tax_included: { type: Sequelize.BOOLEAN, defaultValue: false },
            tax_amount: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
            tax_breakdown: { type: Sequelize.JSONB },
            cod_available: { type: Sequelize.BOOLEAN, defaultValue: true },
            estimated_min_days: { type: Sequelize.INTEGER },
            estimated_max_days: { type: Sequelize.INTEGER },
            checkout_session_id: { type: Sequelize.UUID, allowNull: false },
            cart_hash: { type: Sequelize.STRING(64), allowNull: false },
            address_hash: { type: Sequelize.STRING(64), allowNull: false },
            payment_method: { type: Sequelize.STRING(20), allowNull: false },
            coupon_hash: { type: Sequelize.STRING(64), allowNull: false },
            idempotency_key: { type: Sequelize.STRING(64), allowNull: false },
            input_snapshot: { type: Sequelize.JSONB, defaultValue: {} },
            decision_snapshot: { type: Sequelize.JSONB, defaultValue: {} },
            raw_response: { type: Sequelize.JSONB },
            expires_at: { type: Sequelize.DATE, allowNull: false },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.createTable('shipments', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            order_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'orders', key: 'id' }, onDelete: 'CASCADE' },
            fulfillment_id: { type: Sequelize.UUID, references: { model: 'fulfillments', key: 'id' }, onDelete: 'SET NULL' },
            provider_id: { type: Sequelize.UUID, references: { model: 'shipping_providers', key: 'id' }, onDelete: 'SET NULL' },
            provider_order_id: { type: Sequelize.STRING(255) },
            provider_shipment_id: { type: Sequelize.STRING(255) },
            awb: { type: Sequelize.STRING(255) },
            courier_name: { type: Sequelize.STRING(100) },
            tracking_number: { type: Sequelize.STRING(255) },
            tracking_url: { type: Sequelize.STRING(500) },
            label_url: { type: Sequelize.STRING(500) },
            manifest_url: { type: Sequelize.STRING(500) },
            invoice_url: { type: Sequelize.STRING(500) },
            status: { type: Sequelize.STRING(50), defaultValue: 'pending' },
            status_history: { type: Sequelize.JSONB, defaultValue: [] },
            raw_response: { type: Sequelize.JSONB },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.createTable('shipment_items', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            shipment_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'shipments', key: 'id' }, onDelete: 'CASCADE' },
            order_item_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'order_items', key: 'id' }, onDelete: 'CASCADE' },
            quantity: { type: Sequelize.INTEGER, allowNull: false },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.addIndex('shipment_items', ['shipment_id', 'order_item_id'], {
            name: 'idx_shipment_items_composite',
            unique: true,
        });
        await queryInterface.sequelize.query('ALTER TABLE shipment_items ADD CONSTRAINT shipment_items_quantity_check CHECK (quantity > 0)');

        await queryInterface.createTable('shipment_events', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            shipment_id: { type: Sequelize.UUID, references: { model: 'shipments', key: 'id' }, onDelete: 'SET NULL' },
            provider_id: { type: Sequelize.UUID, references: { model: 'shipping_providers', key: 'id' }, onDelete: 'SET NULL' },
            provider_event_id: { type: Sequelize.STRING(255) },
            awb: { type: Sequelize.STRING(255) },
            event_type: { type: Sequelize.STRING(100) },
            event_status: { type: Sequelize.STRING(100) },
            event_timestamp: { type: Sequelize.DATE },
            payload_hash: { type: Sequelize.STRING(64) },
            raw_payload: { type: Sequelize.JSONB, defaultValue: {} },
            processed_at: { type: Sequelize.DATE },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.addColumn('orders', 'shipping_quote_id', {
            type: Sequelize.UUID,
            references: { model: 'shipping_quotes', key: 'id' },
            onDelete: 'SET NULL',
        });
        await queryInterface.addColumn('orders', 'shipping_snapshot', { type: Sequelize.JSONB });
        await queryInterface.addColumn('orders', 'shipment_status', { type: Sequelize.STRING(50), defaultValue: 'pending' });
        await queryInterface.addColumn('orders', 'checkout_session_id', { type: Sequelize.UUID });
        await queryInterface.addColumn('orders', 'shipping_currency', { type: Sequelize.STRING(10), defaultValue: 'INR' });
        await queryInterface.addColumn('orders', 'shipping_tax_included', { type: Sequelize.BOOLEAN, defaultValue: false });
        await queryInterface.addColumn('orders', 'shipping_tax_amount', { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 });
        await queryInterface.addColumn('orders', 'shipping_tax_breakdown', { type: Sequelize.JSONB });

        await queryInterface.addIndex('shipping_quotes', ['idempotency_key'], { name: 'idx_shipping_quotes_idempotency', unique: true });
        await queryInterface.addIndex('shipping_quotes', ['user_id', 'expires_at'], { name: 'idx_shipping_quotes_user_expiry' });
        await queryInterface.addIndex('shipments', ['order_id'], { name: 'idx_shipments_order' });
        await queryInterface.addIndex('shipment_items', ['shipment_id'], { name: 'idx_shipment_items_shipment' });
        await queryInterface.addIndex('shipment_events', ['provider_id', 'provider_event_id'], {
            name: 'idx_shipment_events_provider_event',
            unique: true,
        });

        await queryInterface.bulkInsert('shipping_providers', [{
            id: 'f0000000-0000-0000-0000-000000000001', // Manual provider is stable across envs
            code: 'manual',
            name: 'Manual Shipping',
            type: 'manual',
            enabled: true,
            is_default: true,
            mode: 'manual',
            supports_cod: true,
            supports_returns: false,
            supports_reverse_pickup: false,
            supports_heavy_items: true,
            supports_fragile_items: true,
            supported_regions: JSON.stringify([]),
            blocked_regions: JSON.stringify([]),
            settings: JSON.stringify({}),
            created_at: new Date(),
            updated_at: new Date(),
        }]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('orders', 'shipping_tax_breakdown');
        await queryInterface.removeColumn('orders', 'shipping_tax_amount');
        await queryInterface.removeColumn('orders', 'shipping_tax_included');
        await queryInterface.removeColumn('orders', 'shipping_currency');
        await queryInterface.removeColumn('orders', 'checkout_session_id');
        await queryInterface.removeColumn('orders', 'shipment_status');
        await queryInterface.removeColumn('orders', 'shipping_snapshot');
        await queryInterface.removeColumn('orders', 'shipping_quote_id');

        await queryInterface.dropTable('shipment_events');
        await queryInterface.dropTable('shipment_items');
        await queryInterface.dropTable('shipments');
        await queryInterface.dropTable('shipping_quotes');
        await queryInterface.dropTable('shipping_providers');
    },
};
