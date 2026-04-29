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

    async getRate(input) {
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
            amount: cost,
            currency: 'INR',
            estimatedMinDays: 2,
            estimatedMaxDays: 5,
            providerRateId: `ekart-rate-${Date.now()}`
        };
    }

    async createShipment(orderData, fulfillmentData) {
        const creds = this._getCredentials();
        logger.info(`[Ekart] Creating shipment for Order ${orderData.id}`);
        
        return {
            success: true,
            providerShipmentId: `EKART-SHIP-${Date.now()}`,
            trackingAwb: `EKT${Date.now()}`,
            labelUrl: 'https://ekart.com/labels/mock-label.pdf',
            rawResponse: { message: 'Mock Ekart shipment created' }
        };
    }

    async cancelShipment(shipmentId, reason) {
        logger.info(`[Ekart] Cancelling shipment ${shipmentId} - reason: ${reason}`);
        return {
            success: true,
            message: 'Cancelled successfully',
            rawResponse: { status: 'CANCELLED' }
        };
    }

    async getTracking(awb) {
        logger.info(`[Ekart] Getting tracking for AWB ${awb}`);
        return {
            status: 'IN_TRANSIT',
            location: 'Ekart Sorting Hub',
            timestamp: new Date().toISOString(),
            rawResponse: { status: 'IN_TRANSIT', city: 'Bangalore' }
        };
    }

    async extractWebhookEvent(payload) {
        if (!payload || !payload.awb) {
            return null; // Ignore invalid payload
        }

        return {
            providerEventId: payload.event_id || null, // Primary dedup key
            awb: payload.awb,
            status: payload.status,
            location: payload.location || '',
            timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
            rawPayload: payload
        };
    }
}

module.exports = EkartProvider;
