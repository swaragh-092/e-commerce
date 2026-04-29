'use strict';

const BaseShippingProvider = require('./base.provider');
const { decryptCredentials } = require('../shipping.crypto');
const logger = require('../../../utils/logger');

/**
 * EkartProvider
 *
 * Ekart Logistics adapter.
 *
 * Rate model (real Ekart pricing as of 2025):
 *   Base    : ₹35 for first 500g
 *   Slab    : +₹18 per additional 500g
 *   Zone    : ×1.0 same_city / ×1.25 same_state / ×1.5 national / ×2.0 remote
 *   Fuel    : +5% on freight
 *   COD     : max(₹20, 2% of declared value)
 *   Min     : ₹35
 *   Divisor : 4000  (Ekart is volumetric-friendly)
 */
const EKART_RATES = {
    baseCharge:           35,
    firstSlabGrams:       500,
    additionalSlabGrams:  500,
    additionalSlabRate:   18,
    fuelSurchargePercent: 5,
    minCharge:            35,
    codFeePercent:        2,
    codFeeMin:            20,
    volumetricDivisor:    4000,
    zoneMultipliers: {
        same_city:  1.0,
        same_state: 1.25,
        national:   1.5,
        remote:     2.0,
    },
    estimatedDays: {
        same_city:  { min: 1, max: 2 },
        same_state: { min: 2, max: 3 },
        national:   { min: 3, max: 5 },
        remote:     { min: 5, max: 8 },
    },
};

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

    async getServiceability({ pincode }) {
        logger.info(`[Ekart] Checking serviceability for pincode ${pincode}`);
        const isIndiaPincode = /^\d{6}$/.test(pincode);
        return {
            serviceable: isIndiaPincode,
            codAvailable: isIndiaPincode,
            reason: isIndiaPincode ? null : 'Invalid or unserviceable pincode',
        };
    }

    /**
     * Calculate shipping rate using real Ekart pricing model.
     *
     * Accepts the unified rate input defined in SHIPPING-RATE-ENGINE.md §6.
     *
     * @param {object} input
     * @param {number} input.weightGrams         - Chargeable weight (already slab-rounded by service)
     * @param {number} input.declaredValue        - Cart subtotal for COD % calc
     * @param {'cod'|'prepaid'} input.paymentMode
     * @param {'same_city'|'same_state'|'national'|'remote'} input.zone
     * @param {number} [input.packageCount]       - Number of packages (multi-package orders)
     */
    async calculateRate({ weightGrams = 500, declaredValue = 0, paymentMode = 'prepaid', zone = 'national', packageCount = 1 }) {
        const rates = EKART_RATES;

        // ── Freight per package ──────────────────────────────────────────────
        let freight = rates.baseCharge;

        if (weightGrams > rates.firstSlabGrams) {
            const extraGrams = weightGrams - rates.firstSlabGrams;
            const extraSlabs = Math.ceil(extraGrams / rates.additionalSlabGrams);
            freight += extraSlabs * rates.additionalSlabRate;
        }

        // Zone multiplier
        const multiplier = rates.zoneMultipliers[zone] || rates.zoneMultipliers.national;
        freight = freight * multiplier;

        // Fuel surcharge on freight only (FIX 6)
        freight = freight + (freight * rates.fuelSurchargePercent / 100);

        // Minimum charge floor (FIX 7)
        freight = Math.max(freight, rates.minCharge);

        // Round to 2dp
        freight = Number(freight.toFixed(2));

        // Multi-package: multiply freight (FIX 9)
        const totalFreight = Number((freight * packageCount).toFixed(2));

        // ── COD fee (separate from freight) (FIX 3) ─────────────────────────
        let codFee = 0;
        if (paymentMode === 'cod') {
            codFee = Math.max(rates.codFeeMin, declaredValue * rates.codFeePercent / 100);
            codFee = Number(codFee.toFixed(2));
        }

        const days = rates.estimatedDays[zone] || rates.estimatedDays.national;

        return {
            rate:                  Number((totalFreight + codFee).toFixed(2)),
            freight:               totalFreight,
            codFee,
            currency:              'INR',
            estimatedMinDays:      days.min,
            estimatedMaxDays:      days.max,
            chargeableWeightGrams: weightGrams,
            zone,
            packageCount,
            rawResponse: {
                provider: 'ekart',
                mock: true,
                weightGrams,
                zone,
                multiplier,
                packageCount,
            },
        };
    }

    async createShipment({ order, shipment }) {
        // eslint-disable-next-line no-unused-vars
        const creds = this._getCredentials();
        logger.info(`[Ekart] Creating shipment for Order ${order.id}`);
        const ts = Date.now();
        return {
            awbCode:         `EKT${ts}`,
            providerOrderId: `EKART-ORD-${ts}`,
            label:           'https://ekart.com/labels/mock-label.pdf',
            trackingUrl:     `https://ekart.com/track/EKT${ts}`,
            rawResponse:     { message: 'Mock Ekart shipment created', mock: true },
        };
    }

    async cancelShipment({ awbCode }) {
        logger.info(`[Ekart] Cancelling shipment ${awbCode}`);
        return { success: true, message: 'Cancelled successfully', rawResponse: { status: 'CANCELLED' } };
    }

    async getTracking({ awbCode }) {
        logger.info(`[Ekart] Getting tracking for AWB ${awbCode}`);
        return {
            status:    'in_transit',
            location:  'Ekart Sorting Hub, Bangalore',
            timestamp: new Date(),
            events:    [{ status: 'in_transit', location: 'Sorting Hub', timestamp: new Date(), description: 'In transit' }],
            rawResponse: { mock: true },
        };
    }

    async handleWebhook(payload) {
        if (!payload?.awb) return null;
        return {
            providerEventId: payload.event_id ? String(payload.event_id) : null,
            awbCode:         payload.awb,
            status:          this._normalizeStatus(payload.status),
            location:        payload.location || '',
            timestamp:       (() => {
                const d = payload.timestamp ? new Date(payload.timestamp) : null;
                return d && !isNaN(d.getTime()) ? d : new Date();
            })(),
            rawPayload:      payload,
        };
    }

    _normalizeStatus(status) {
        const s = String(status || '').toLowerCase();
        if (s.includes('delivered')) return 'delivered';
        if (s.includes('out'))       return 'out_for_delivery';
        if (s.includes('return'))    return 'returned';
        if (s.includes('cancel'))    return 'cancelled';
        if (s.includes('fail') || s.includes('attempt') || s.includes('un-deliver')) return 'delivery_failed';
        return 'in_transit';
    }
}

module.exports = EkartProvider;
