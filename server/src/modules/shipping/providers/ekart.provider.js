'use strict';

const BaseShippingProvider = require('./base.provider');
const { decryptCredentials } = require('../shipping.crypto');
const logger = require('../../../utils/logger');

/**
 * EkartProvider
 *
 * Implements the Ekart API integration for shipping.
 */
class EkartProvider extends BaseShippingProvider {
    constructor(providerRecord) {
        super(providerRecord);
        this.apiBase = this.settings?.apiUrl || 'https://api.ekartlogistics.com/v1';
    }

    _getCredentials() {
        if (!this.record.credentialsEncrypted) {
            throw new Error(`Ekart credentials missing for provider ${this.id}`);
        }
        return decryptCredentials(this.record.credentialsEncrypted);
    }

    async getServiceability(input) {
        // Mock Ekart Serviceability
        logger.info(`[Ekart] Checking serviceability for pincode ${input.pincode}`);
        // Let's assume all valid-looking Indian pincodes are serviceable
        const isIndiaPincode = /^\d{6}$/.test(input.pincode);
        return {
            serviceable: isIndiaPincode,
            codAvailable: isIndiaPincode && input.paymentMode !== 'prepaid',
            reason: isIndiaPincode ? null : 'Invalid or unserviceable pincode'
        };
    }

    async calculateRate(input) {
        logger.info(`[Ekart] Getting rate for pincode ${input.pincode}`);
        // Mock Ekart Rate
        const weightKg = input.weightGrams ? input.weightGrams / 1000 : 0.5;
        const baseRate = 45; // base rate ₹45 for 500g
        const perKgRate = 40;
        
        let cost = baseRate;
        if (weightKg > 0.5) {
            cost += Math.ceil((weightKg - 0.5) / 0.5) * (perKgRate / 2);
        }

        if (input.paymentMode === 'cod') {
            cost += 50; // COD fee
        }

        return {
            rate: cost,
            currency: 'INR',
            estimatedMinDays: 2,
            estimatedMaxDays: 5,
            rawResponse: { mock: true, baseRate: 45 }
        };
    }

    async createShipment({ order, shipment, address, items }) {
        // eslint-disable-next-line no-unused-vars
        const creds = this._getCredentials();
        logger.info(`[Ekart] Creating shipment for Order ${order.id}`);
        
        const timestamp = Date.now();
        return {
            awbCode: `EKT${timestamp}`,
            providerOrderId: `EKART-ORD-${timestamp}`,
            label: 'https://ekart.com/labels/mock-label.pdf',
            trackingUrl: `https://ekart.com/track/EKT${timestamp}`,
            rawResponse: { message: 'Mock Ekart shipment created' }
        };
    }

    async cancelShipment({ awbCode }) {
        logger.info(`[Ekart] Cancelling shipment ${awbCode}`);
        return {
            success: true,
            message: 'Cancelled successfully',
            rawResponse: { status: 'CANCELLED' }
        };
    }

    async getTracking({ awbCode }) {
        logger.info(`[Ekart] Getting tracking for AWB ${awbCode}`);
        return {
            status: 'in_transit',
            location: 'Ekart Sorting Hub',
            timestamp: new Date(),
            events: [
                {
                    status: 'in_transit',
                    location: 'Sorting Hub',
                    timestamp: new Date(),
                    description: 'Package received at sorting facility'
                }
            ],
            rawResponse: { status: 'IN_TRANSIT', city: 'Bangalore' }
        };
    }

    async handleWebhook(payload) {
        if (!payload || !payload.awb) {
            return null; // Ignore invalid payload
        }

        return {
            providerEventId: payload.event_id ? String(payload.event_id) : null,
            awbCode: payload.awb,
            status: this._normalizeStatus(payload.status),
            location: payload.location || '',
            timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
            rawPayload: payload
        };
    }

    _normalizeStatus(status) {
        const s = String(status || '').toLowerCase();
        if (s.includes('deliver')) return 'delivered';
        if (s.includes('out')) return 'out_for_delivery';
        if (s.includes('transit')) return 'in_transit';
        if (s.includes('return')) return 'returned';
        if (s.includes('cancel')) return 'cancelled';
        return 'in_transit';
    }
}

module.exports = EkartProvider;
