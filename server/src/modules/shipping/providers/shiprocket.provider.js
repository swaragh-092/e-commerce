'use strict';

const axios = require('axios');
const crypto = require('crypto');
const BaseShippingProvider = require('./base.provider');

const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external';

const { decryptCredentials } = require('../shipping.crypto');

/**
 * ShiprocketProvider
 *
 * Implements the standard shipping adapter interface against Shiprocket's REST API.
 *
 * Credentials expected in ShippingProvider.credentialsEncrypted (JSON):
 *   { email, password }
 *
 * WHY token-per-instance:
 *   Shiprocket tokens are valid for 24 hours. We cache on the instance so
 *   repeated calls within the same request lifecycle don't re-authenticate.
 *   A production setup should persist this token to Redis with a 23-hour TTL.
 */
class ShiprocketProvider extends BaseShippingProvider {
    constructor(providerRecord) {
        super(providerRecord);
        this._token = null;
        this._tokenExpiry = null;
        this._credentials = decryptCredentials(providerRecord.credentialsEncrypted);
    }

    /* ------------------------------------------------------------------ */
    /* Auth                                                                  */
    /* ------------------------------------------------------------------ */

    async _getToken() {
        // Return cached token if still valid (refresh 5 mins early)
        if (this._token && this._tokenExpiry && Date.now() < this._tokenExpiry - 5 * 60 * 1000) {
            return this._token;
        }

        const { email, password } = this._credentials;
        if (!email || !password) {
            throw new Error('Shiprocket credentials (email/password) are not configured.');
        }

        try {
            const { data } = await axios.post(`${SHIPROCKET_API_BASE}/auth/login`, { email, password });
            
            if (!data || !data.token) {
                throw new Error(`Shiprocket auth failed: ${data?.message || 'Token missing in response'}`);
            }

            this._token = data.token;
            // Shiprocket tokens last 24 hours
            this._tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
            return this._token;
        } catch (error) {
            const message = error.response?.data?.message || error.message;
            throw new Error(`Shiprocket authentication error: ${message}`);
        }
    }

    _authHeader(token) {
        return { Authorization: `Bearer ${token}` };
    }

    /* ------------------------------------------------------------------ */
    /* Serviceability                                                         */
    /* ------------------------------------------------------------------ */

    async getServiceability({ pincode, pickupPincode, weightGrams = 500, paymentMode = 'prepaid' }) {
        const token = await this._getToken();

        const codMode = paymentMode === 'cod' ? 1 : 0;
        const weightKg = Math.max(0.1, weightGrams / 1000);

        const { data } = await axios.get(`${SHIPROCKET_API_BASE}/courier/serviceability/`, {
            headers: this._authHeader(token),
            params: {
                pickup_postcode: pickupPincode || this.settings.pickupPincode,
                delivery_postcode: pincode,
                weight: weightKg,
                cod: codMode,
            },
        });

        const available = data.data?.available_courier_companies || [];
        const serviceable = available.length > 0;
        const codAvailable = available.some(c => c.cod === 1);

        return {
            serviceable,
            codAvailable,
            reason: serviceable ? null : 'No courier available for this pincode',
            rawResponse: data,
        };
    }

    /* ------------------------------------------------------------------ */
    /* Rate Calculation                                                       */
    /* ------------------------------------------------------------------ */

    /**
     * Calculate rate using Shiprocket API (with local fallback).
     *
     * Unified input per SHIPPING-RATE-ENGINE.md §6.
     *
     * @param {number} weightGrams         - Chargeable (already slab-rounded by service)
     * @param {number} declaredValue        - Cart subtotal
     * @param {'cod'|'prepaid'} paymentMode
     * @param {'same_city'|'same_state'|'national'|'remote'} zone
     * @param {number} packageCount
     * @param {string} pincode
     * @param {string} pickupPincode
     */
    async calculateRate({ pincode, pickupPincode, weightGrams = 500, declaredValue = 0, paymentMode = 'prepaid', zone = 'national', packageCount = 1 }) {
        // If credentials are not configured, use local rate model (development/mock mode)
        try {
            if (!this._credentials?.email || !this._credentials?.password) {
                return this._calculateLocalRate({ weightGrams, declaredValue, paymentMode, zone, packageCount });
            }

            const token = await this._getToken();
            const codMode = paymentMode === 'cod' ? 1 : 0;
            const weightKg = Math.max(0.1, weightGrams / 1000);

            const { data } = await axios.get(`${SHIPROCKET_API_BASE}/courier/serviceability/`, {
                headers: this._authHeader(token),
                params: {
                    pickup_postcode:   pickupPincode || this.settings.pickupPincode,
                    delivery_postcode: pincode,
                    weight:            weightKg,
                    cod:               codMode,
                    declared_value:    declaredValue,
                },
            });

            const companies = data.data?.available_courier_companies || [];
            if (companies.length === 0) {
                return this._calculateLocalRate({ weightGrams, declaredValue, paymentMode, zone, packageCount });
            }

            const recommended = companies.find(c => c.is_recommended) || companies[0];
            const rate        = Number(recommended.rate) || 0;
            const days        = Number(recommended.estimated_delivery_days) || null;

            return {
                rate,
                freight:               rate,   // Shiprocket returns bundled; no COD split from API
                codFee:                0,
                currency:              'INR',
                estimatedMinDays:      days,
                estimatedMaxDays:      days ? days + 1 : null,
                chargeableWeightGrams: weightGrams,
                zone,
                packageCount,
                rawResponse: { courierId: recommended.courier_company_id, courierName: recommended.courier_name },
            };
        } catch (_err) {
            // API unavailable — fall back to local model so checkout doesn't break
            console.warn('[ShiprocketProvider] calculateRate API error, using local fallback:', _err.message);
            return this._calculateLocalRate({ weightGrams, declaredValue, paymentMode, zone, packageCount });
        }
    }

    /**
     * Local rate model — mirrors Shiprocket Zone A/B/C/D pricing.
     * Used in dev/mock mode or when the live API is unreachable.
     *
     * Zone A = same_city, B = same_state, C = national, D = remote
     */
    _calculateLocalRate({ weightGrams = 500, declaredValue = 0, paymentMode = 'prepaid', zone = 'national', packageCount = 1 }) {
        const baseByZone = { same_city: 40, same_state: 55, national: 70, remote: 110 };
        const slabRate   = 20;    // per additional 500g
        const fuelPct    = 3;     // fuel surcharge %
        const codPct     = 2;     // COD % of order value
        const codMin     = 30;    // COD minimum fee
        const minCharge  = 40;

        let freight = baseByZone[zone] || baseByZone.national;

        if (weightGrams > 500) {
            const extraSlabs = Math.ceil((weightGrams - 500) / 500);
            freight += extraSlabs * slabRate;
        }

        // Fuel surcharge on freight only (FIX 6)
        freight = freight + (freight * fuelPct / 100);

        // Min charge floor (FIX 7)
        freight = Math.max(freight, minCharge);
        freight = Number(freight.toFixed(2));

        // Multi-package (FIX 9)
        const totalFreight = Number((freight * packageCount).toFixed(2));

        // COD fee separate (FIX 3)
        let codFee = 0;
        if (paymentMode === 'cod') {
            codFee = Math.max(codMin, declaredValue * codPct / 100);
            codFee = Number(codFee.toFixed(2));
        }

        const estimatedDays = { same_city: [1,2], same_state: [2,3], national: [4,6], remote: [6,9] };
        const [minDays, maxDays] = estimatedDays[zone] || estimatedDays.national;

        return {
            rate:                  Number((totalFreight + codFee).toFixed(2)),
            freight:               totalFreight,
            codFee,
            currency:              'INR',
            estimatedMinDays:      minDays,
            estimatedMaxDays:      maxDays,
            chargeableWeightGrams: weightGrams,
            zone,
            packageCount,
            rawResponse:           { mock: true, zone, weightGrams, packageCount },
        };
    }


    /* ------------------------------------------------------------------ */
    /* Create Shipment                                                        */
    /* ------------------------------------------------------------------ */

    async createShipment({ order, shipment, address, items }) {
        const token = await this._getToken();

        const payload = {
            order_id: order.orderNumber,
            order_date: new Date(order.createdAt).toISOString().split('T')[0],
            pickup_location: this.settings.pickupLocationName || 'Primary',
            billing_customer_name: address.firstName,
            billing_last_name: address.lastName || '',
            billing_address: address.line1,
            billing_address_2: address.line2 || '',
            billing_city: address.city,
            billing_pincode: address.postalCode,
            billing_state: address.state,
            billing_country: address.country || 'India',
            billing_email: order.user?.email || '',
            billing_phone: address.phone,
            shipping_is_billing: 1,
            order_items: items.map(i => ({
                name: i.snapshotName || i.name,
                sku: i.snapshotSku || i.sku || 'SKU',
                units: i.quantity,
                selling_price: Number(i.unitPrice || 0),
                discount: 0,
                tax: 0,
                hsn: i.hsnCode || '',
            })),
            payment_method: order.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
            sub_total: Number(order.subtotal || 0),
            length: Number(shipment.lengthCm || this.settings.defaultLengthCm || 10),
            breadth: Number(shipment.breadthCm || this.settings.defaultBreadthCm || 10),
            height: Number(shipment.heightCm || this.settings.defaultHeightCm || 10),
            weight: Math.max(0.1, (shipment.actualWeightGrams || 500) / 1000),
        };

        const { data } = await axios.post(`${SHIPROCKET_API_BASE}/orders/create/adhoc`, payload, {
            headers: this._authHeader(token),
        });

        return {
            awbCode: data.payload?.awb_code || '',
            providerOrderId: String(data.payload?.shipment_id || ''),
            label: data.payload?.label || null,
            trackingUrl: data.payload?.awb_code
                ? `https://shiprocket.co/tracking/${data.payload.awb_code}`
                : null,
            rawResponse: data,
        };
    }

    /* ------------------------------------------------------------------ */
    /* Cancel Shipment                                                        */
    /* ------------------------------------------------------------------ */

    async cancelShipment({ awbCode }) {
        const token = await this._getToken();

        const { data } = await axios.post(
            `${SHIPROCKET_API_BASE}/orders/cancel`,
            { awbs: [awbCode] },
            { headers: this._authHeader(token) },
        );

        // Derive success from response schema
        const success = Boolean(data.success) || data.status === 'cancelled' || data.code === 200;

        return {
            success,
            message: data.message || (success ? 'Cancelled' : 'Cancellation failed'),
            rawResponse: data,
        };
    }

    /* ------------------------------------------------------------------ */
    /* Tracking                                                               */
    /* ------------------------------------------------------------------ */

    async getTracking({ awbCode }) {
        const token = await this._getToken();

        const { data } = await axios.get(
            `${SHIPROCKET_API_BASE}/courier/track/awb/${awbCode}`,
            { headers: this._authHeader(token) },
        );

        const tracking = data.tracking_data;
        const events = (tracking?.shipment_track_activities || []).map(e => ({
            status: e['sr-status-label'] || e.status || '',
            location: e.location || '',
            timestamp: e.date ? new Date(e.date) : new Date(),
            description: e.activity || '',
        }));

        const statusMap = {
            'PICKED UP': 'in_transit',
            'IN TRANSIT': 'in_transit',
            'OUT FOR DELIVERY': 'out_for_delivery',
            'DELIVERED': 'delivered',
            'CANCELLED': 'cancelled',
            'RTO INITIATED': 'rto',
            'RTO DELIVERED': 'rto',
        };

        const rawStatus = tracking?.shipment_status || events[0]?.status || 'unknown';
        const mappedStatus = statusMap[String(rawStatus).toUpperCase()] || 'unknown';

        return {
            status: mappedStatus,
            location: events[0]?.location || '',
            timestamp: events[0]?.timestamp || new Date(),
            events,
            rawResponse: data,
        };
    }

    /* ------------------------------------------------------------------ */
    /* Webhook                                                                */
    /* ------------------------------------------------------------------ */

    async verifySignature(payload, signature, secret) {
        if (!secret) return true;
        if (!signature) return false;

        const rawBody = Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload));
        const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
        
        try {
            return crypto.timingSafeEqual(
                Buffer.from(computed, 'hex'),
                Buffer.from(signature, 'hex')
            );
        } catch (err) {
            return false;
        }
    }

    async verifyWebhookSignature(rawPayload, headers) {
        const secret = this.settings.webhookSecret || this._credentials.webhookSecret;
        const signature = headers['x-shiprocket-signature'] || headers['X-Shiprocket-Signature'] || headers['x-api-key'];
        return this.verifySignature(rawPayload, signature, secret);
    }

    async handleWebhook(payload) {
        // Shiprocket sends multipart/form-data or JSON depending on config
        const awbCode = payload.awb || payload.AWB || '';
        const status = payload['current-status'] || payload.status || 'unknown';
        const location = payload['current-city'] || payload.location || '';
        const providerEventId = payload.scan_id || payload.id || null;

        const timestamp = payload.scan_date_time || payload.timestamp || payload.date || new Date();

        return {
            providerEventId: providerEventId ? String(providerEventId) : null,
            awbCode,
            status: this._normalizeStatus(status),
            location,
            timestamp: new Date(timestamp),
            rawPayload: payload,
        };
    }

    _normalizeStatus(srStatus) {
        const s = String(srStatus).toLowerCase();
        if (s.includes('delivered')) return 'delivered';
        if (s.includes('out for delivery')) return 'out_for_delivery';
        if (s.includes('pickup')) return 'picked_up';
        if (s.includes('in transit') || s.includes('transit')) return 'in_transit';
        if (s.includes('returned')) return 'returned';
        if (s.includes('cancel')) return 'cancelled';
        return 'in_transit';
    }
}

module.exports = ShiprocketProvider;
