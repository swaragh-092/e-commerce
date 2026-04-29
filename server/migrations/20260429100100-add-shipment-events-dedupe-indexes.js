'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Primary dedupe: provider_id + provider_event_id where provider_event_id is not null
        await queryInterface.addIndex('shipment_events', ['provider_id', 'provider_event_id'], {
            name: 'idx_shipment_events_primary_dedupe',
            unique: true,
            where: {
                provider_event_id: {
                    [Sequelize.Op.ne]: null
                }
            }
        });

        // Fallback dedupe: provider_id + awb + event_status + event_timestamp + payload_hash
        await queryInterface.addIndex('shipment_events', ['provider_id', 'awb', 'event_status', 'event_timestamp', 'payload_hash'], {
            name: 'idx_shipment_events_fallback_dedupe',
            unique: true,
            where: {
                provider_event_id: null
            }
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeIndex('shipment_events', 'idx_shipment_events_primary_dedupe');
        await queryInterface.removeIndex('shipment_events', 'idx_shipment_events_fallback_dedupe');
    }
};
