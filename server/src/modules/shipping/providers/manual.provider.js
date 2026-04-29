'use strict';

const BaseShippingProvider = require('./base.provider');

/**
 * ManualProvider
 *
 * The "default" provider — no external API. Serviceability and rates are
 * driven entirely by admin-configured ShippingRules and ShippingZones.
 *
 * WHY this exists:
 *   The ShippingService always resolves a provider. When no third-party
 *   integration is active, ManualProvider fulfils the adapter contract so
 *   the service layer never needs null-checks.
 */
class ManualProvider extends BaseShippingProvider {
    async getServiceability() {
        // Serviceability is already validated by zone/rule matching in ShippingService.
        // The manual provider simply agrees with whatever the rule engine decided.
        return { serviceable: true, codAvailable: true };
    }

    async calculateRate() {
        // Rate comes from the matched ShippingRule, not from any API.
        return { rate: 0, currency: 'INR', estimatedMinDays: null, estimatedMaxDays: null };
    }

    async createShipment({ shipment = {} } = {}) {
        // Manual shipments just use what the admin entered in the FulfillmentDialog.
        return {
            awbCode: shipment?.trackingNumber || 'MANUAL',
            providerOrderId: null,
            label: null,
            trackingUrl: null,
        };
    }

    async cancelShipment() {
        return { success: true, message: 'Manual shipment cancelled' };
    }

    async getTracking({ awbCode }) {
        return {
            status: 'in_transit',
            location: '',
            timestamp: new Date(),
            events: [{ status: 'in_transit', location: '', timestamp: new Date(), description: `Tracking: ${awbCode}` }],
        };
    }

    async handleWebhook(payload) {
        const p = payload || {};
        return {
            awbCode: p.awb || '',
            status: p.status || 'in_transit',
            location: p.location || '',
            timestamp: new Date(),
            rawPayload: payload || {},
        };
    }
}

module.exports = ManualProvider;
