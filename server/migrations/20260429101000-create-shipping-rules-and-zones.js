'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('shipping_zones', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            name: { type: Sequelize.STRING(100), allowNull: false },
            country: { type: Sequelize.STRING(100) },
            state: { type: Sequelize.STRING(100) },
            city: { type: Sequelize.STRING(100) },
            pincodes: { type: Sequelize.JSONB, defaultValue: [] },
            blocked_pincodes: { type: Sequelize.JSONB, defaultValue: [] },
            enabled: { type: Sequelize.BOOLEAN, defaultValue: true },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.createTable('shipping_rules', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            name: { type: Sequelize.STRING(150), allowNull: false },
            priority: { type: Sequelize.INTEGER, defaultValue: 100 },
            enabled: { type: Sequelize.BOOLEAN, defaultValue: true },
            strict_override: { type: Sequelize.BOOLEAN, defaultValue: false },
            zone_id: { type: Sequelize.UUID, references: { model: 'shipping_zones', key: 'id' }, onDelete: 'SET NULL' },
            provider_id: { type: Sequelize.UUID, references: { model: 'shipping_providers', key: 'id' }, onDelete: 'SET NULL' },
            condition_type: { type: Sequelize.STRING(50), defaultValue: 'all' },
            conditions: { type: Sequelize.JSONB, defaultValue: {} },
            rate_type: { type: Sequelize.STRING(50), defaultValue: 'flat' },
            rate_config: { type: Sequelize.JSONB, defaultValue: {} },
            cod_allowed: { type: Sequelize.BOOLEAN, defaultValue: true },
            cod_fee: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
            estimated_min_days: { type: Sequelize.INTEGER },
            estimated_max_days: { type: Sequelize.INTEGER },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.createTable('shipping_rule_history', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            rule_id: { type: Sequelize.UUID, references: { model: 'shipping_rules', key: 'id' }, onDelete: 'SET NULL' },
            changed_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
            change_type: { type: Sequelize.STRING(50), allowNull: false },
            old_value: { type: Sequelize.JSONB },
            new_value: { type: Sequelize.JSONB },
            reason: { type: Sequelize.TEXT },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.addIndex('shipping_zones', ['enabled'], { name: 'idx_shipping_zones_enabled' });
        await queryInterface.addIndex('shipping_rules', ['enabled', 'priority'], { name: 'idx_shipping_rules_enabled_priority' });
        await queryInterface.addIndex('shipping_rule_history', ['rule_id'], { name: 'idx_shipping_rule_history_rule' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('shipping_rule_history');
        await queryInterface.dropTable('shipping_rules');
        await queryInterface.dropTable('shipping_zones');
    },
};
