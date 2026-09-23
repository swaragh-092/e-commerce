'use strict';

const axios = require('axios');
const crypto = require('crypto');
const BaseShippingProvider = require('./base.provider');

const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external';
const TOKEN_TTL_MS = 240 * 60 * 60 * 1000;

const { decryptCredentials, decryptSecret } = require('../shipping.crypto');

/**
 * ShiprocketProvider
 *
 * Implements the standard shipping adapter interface against Shiprocket's REST API.
 *
 * Credentials expected in ShippingProvider.credentialsEncrypted (JSON):
 *   { email, password }
 *
 * Shiprocket tokens are documented as valid for 240 hours (10 days). The
 * adapter caches per instance and refreshes on expiry/401. A multi-instance
 * deployment may additionally cache the token in Redis, but must still keep
 * the 401 retry because providers can revoke tokens early.
 */
class ShiprocketProvider extends BaseShippingProvider {
    constructor(providerRecord) {
        super(providerRecord);
        this._token = null;
        this._tokenExpiry = null;
        this._credentials = decryptCredentials(providerRecord.credentialsEncrypted || providerRecord.credentials);
        this._webhookSecret = decryptSecret(providerRecord.webhookSecret);
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
            const { data } = await axios.post(`${this._baseUrl()}/auth/login`, { email, password });
            
            if (!data || !data.token) {
                throw new Error(`Shiprocket auth failed: ${data?.message || 'Token missing in response'}`);
            }

            this._token = data.token;
            const tokenPayload = String(data.token).split('.')[1];
            let expiresAt = null;
            try {
                expiresAt = tokenPayload ? JSON.parse(Buffer.from(tokenPayload, 'base64url').toString('utf8')).exp * 1000 : null;
            } catch (_) {}
            this._tokenExpiry = Number.isFinite(expiresAt) && expiresAt > Date.now()
                ? expiresAt
                : Date.now() + TOKEN_TTL_MS;
            return this._token;
        } catch (error) {
            const message = error.response?.data?.message || error.message;
            throw new Error(`Shiprocket authentication error: ${message}`);
        }
    }

    _authHeader(token) {
        return { Authorization: `Bearer ${token}` };
    }

    _baseUrl() {
        return String(this.settings.apiBaseUrl || process.env.SHIPROCKET_API_BASE || SHIPROCKET_API_BASE).replace(/\/+$/, '');
    }

    _mockEnabled() {
        return process.env.NODE_ENV !== 'production'
            && (this.settings.allowMock === true || this.record.mode === 'mock');
    }

    async _request(config, { retryAuth = true } = {}) {
        const token = await this._getToken();
        try {
            return await axios({
                ...config,
                url: config.url.startsWith('http') ? config.url : `${this._baseUrl()}${config.url}`,
                headers: { ...this._authHeader(token), ...(config.headers || {}) },
            });
        } catch (error) {
            if (retryAuth && error.response?.status === 401) {
                this._token = null;
                this._tokenExpiry = null;
                return this._request(config, { retryAuth: false });
            }
            throw error;
        }
    }

    _providerValue(data, paths = []) {
        for (const path of paths) {
            const value = path.split('.').reduce((current, key) => current?.[key], data);
            if (value !== undefined && value !== null && value !== '') return value;
        }
        return null;
    }

    /* ------------------------------------------------------------------ */
    /* Serviceability                                                         */
    /* ------------------------------------------------------------------ */

    async getServiceability({ pincode, pickupPincode, weightGrams = 500, paymentMode = 'prepaid' }) {
        if (!this._credentials?.email || !this._credentials?.password) {
            if (!this._mockEnabled()) throw new Error('Shiprocket credentials are not configured. Enable mock mode only for local development.');
            const isIndiaPincode = /^\d{6}$/.test(String(pincode || '').trim());
            return {
                serviceable: isIndiaPincode,
                codAvailable: true,
                reason: isIndiaPincode ? null : 'Invalid or unserviceable pincode',
                rawResponse: { mock: true, pincode },
            };
        }

        try {
            const codMode = paymentMode === 'cod' ? 1 : 0;
            const weightKg = Math.max(0.1, weightGrams / 1000);

            const { data } = await this._request({
                method: 'get',
                url: '/courier/serviceability/',
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
        } catch (err) {
            console.error('[ShiprocketProvider] getServiceability API error:', err.message);
            throw new Error(`Shiprocket serviceability failed: ${err.response?.data?.message || err.message}`);
        }
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
        // The local model is available only when explicitly enabled for development.
        try {
            if (!this._credentials?.email || !this._credentials?.password) {
                if (!this._mockEnabled()) throw new Error('Shiprocket credentials are not configured.');
                return this._calculateLocalRate({ weightGrams, declaredValue, paymentMode, zone, packageCount });
            }

            const codMode = paymentMode === 'cod' ? 1 : 0;
            const weightKg = Math.max(0.1, weightGrams / 1000);

            const { data } = await this._request({
                method: 'get',
                url: '/courier/serviceability/',
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
                throw new Error('No Shiprocket courier is available for this destination and package.');
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
            throw new Error(`Shiprocket rate calculation failed: ${_err.response?.data?.message || _err.message}`);
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

    async createShipment({ order, shipment, address = {}, items }) {
        const fullName = address.fullName || `${address.firstName || ''} ${address.lastName || ''}`.trim() || 'Customer';
        const nameParts = fullName.split(' ');
        const firstName = address.firstName || nameParts[0] || 'Customer';
        const lastName = address.lastName || nameParts.slice(1).join(' ') || '';
        const line1 = address.addressLine1 || address.line1 || '';
        const line2 = address.addressLine2 || address.line2 || '';
        const postalCode = String(address.postalCode || address.pincode || '').trim();
        const phone = String(address.phone || '').replace(/\D/g, '').slice(-10);

        if (!this._credentials?.email || !this._credentials?.password) {
            if (!this._mockEnabled()) throw new Error('Shiprocket credentials are not configured. Enable mock mode only for local development.');
            const ts = Date.now();
            return {
                awbCode: `SR${ts}`,
                providerOrderId: `SR-ORD-${ts}`,
                providerShipmentId: `SR-SHIP-${ts}`,
                label: 'https://shiprocket.co/mock-label.pdf',
                trackingUrl: `https://shiprocket.co/tracking/SR${ts}`,
                rawResponse: { message: 'Mock Shiprocket shipment created (credentials not configured)', mock: true },
            };
        }

        if (!line1 || !postalCode || !address.city || !address.state || phone.length !== 10) {
            throw new Error('Shiprocket shipment requires address line, city, state, 6-digit pincode, and a valid 10-digit phone number.');
        }

        const payload = {
            order_id: shipment.providerRequestId || order.orderNumber,
            order_date: new Date(order.createdAt).toISOString().split('T')[0],
            pickup_location: this.settings.pickupLocationName || 'Primary',
            billing_customer_name: firstName,
            billing_last_name: lastName,
            billing_address: line1,
            billing_address_2: line2,
            billing_city: address.city,
            billing_pincode: postalCode,
            billing_state: address.state,
            billing_country: address.country || 'India',
            billing_email: order.user?.email || '',
            billing_phone: phone,
            shipping_is_billing: 1,
            order_items: items.map(i => ({
                name: i.snapshotName || i.name || 'Product',
                sku: i.snapshotSku || i.sku || 'SKU',
                units: i.quantity,
                selling_price: Number(i.unitPrice || 0),
                discount: 0,
                tax: 0,
                hsn: i.hsnCode || '',
            })),
            payment_method: order.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
            sub_total: Number(order.subtotal || 0),
            shipping_charges: Number(order.shippingCost || 0),
            total_discount: Number(order.discountAmount || 0),
            tax: Number(order.tax || 0),
            order_total: Number(order.total || order.subtotal || 0),
            length: Number(shipment.lengthCm || this.settings.defaultLengthCm || 10),
            breadth: Number(shipment.breadthCm || this.settings.defaultBreadthCm || 10),
            height: Number(shipment.heightCm || this.settings.defaultHeightCm || 10),
            weight: Math.max(0.1, (shipment.actualWeightGrams || 500) / 1000),
        };

        const { data } = await this._request({ method: 'post', url: '/orders/create/adhoc', data: payload });
        const providerOrderId = String(this._providerValue(data, ['order_id', 'payload.order_id', 'data.order_id']) || payload.order_id);
        const providerShipmentId = this._providerValue(data, ['shipment_id', 'payload.shipment_id', 'data.shipment_id', 'response.data.shipment_id']);
        if (!providerShipmentId) throw new Error('Shiprocket did not return a shipment ID after order creation.');

        const assignResponse = await this._request({
            method: 'post',
            url: '/courier/assign/awb',
            data: { shipment_id: providerShipmentId },
        });
        const awbCode = this._providerValue(assignResponse.data, [
            'awb_code', 'payload.awb_code', 'data.awb_code', 'response.data.awb_code',
        ]);
        const courierName = this._providerValue(assignResponse.data, [
            'courier_name', 'payload.courier_name', 'data.courier_name', 'response.data.courier_name',
        ]);
        if (!awbCode) throw new Error('Shiprocket did not assign an AWB.');

        const pickupResponse = await this._request({
            method: 'post',
            url: '/courier/generate/pickup',
            data: { shipment_id: [providerShipmentId] },
        });
        const labelResponse = await this._request({
            method: 'post',
            url: '/courier/generate/label',
            data: { shipment_id: [providerShipmentId] },
        });
        const invoiceResponse = await this._request({
            method: 'post',
            url: '/orders/print/invoice',
            data: { ids: [providerOrderId] },
        });
        const manifestResponse = await this._request({
            method: 'post',
            url: '/manifests/generate',
            data: { shipment_id: [providerShipmentId] },
        });

        const label = this._providerValue(labelResponse.data, ['label_url', 'payload.label_url', 'data.label_url', 'response.data.label_url']);
        const invoice = this._providerValue(invoiceResponse.data, ['invoice_url', 'payload.invoice_url', 'data.invoice_url', 'response.data.invoice_url']);
        const manifest = this._providerValue(manifestResponse.data, ['manifest_url', 'payload.manifest_url', 'data.manifest_url', 'response.data.manifest_url']);

        return {
            awbCode: String(awbCode),
            providerOrderId,
            providerShipmentId: String(providerShipmentId),
            courierName: courierName || null,
            label: label || null,
            manifest: manifest || null,
            invoice: invoice || null,
            trackingUrl: `https://shiprocket.co/tracking/${awbCode}`,
            rawResponse: data,
            lifecycle: {
                create: data,
                assign: assignResponse.data,
                pickup: pickupResponse.data,
                label: labelResponse.data,
                invoice: invoiceResponse.data,
                manifest: manifestResponse.data,
            },
        };
    }

    /* ------------------------------------------------------------------ */
    /* Cancel Shipment                                                        */
    /* ------------------------------------------------------------------ */

    async cancelShipment({ awbCode }) {
        const { data } = await this._request({
            method: 'post',
            url: '/orders/cancel/shipment/awbs',
            data: { awbs: [awbCode] },
        });

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
        const { data } = await this._request({
            method: 'get',
            url: `/courier/track/awb/${encodeURIComponent(awbCode)}`,
        });

        const tracking = data.tracking_data;
        const events = (tracking?.shipment_track_activities || []).map(e => ({
            status: e['sr-status-label'] || e.status || '',
            location: e.location || '',
            timestamp: e.date ? new Date(e.date) : new Date(),
            description: e.activity || '',
        }));
        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const statusMap = {
            'PACKED': 'packed',
            'SHIPPED': 'shipped',
            'PICKED UP': 'in_transit',
            'IN TRANSIT': 'in_transit',
            'OUT FOR DELIVERY': 'out_for_delivery',
            'DELIVERED': 'delivered',
            'CANCELLED': 'cancelled',
            'RTO INITIATED': 'rto_initiated',
            'RTO IN TRANSIT': 'rto_in_transit',
            'RTO DELIVERED': 'rto',
            'DELIVERY DELAYED': 'delivery_failed',
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
        if (!secret) return false;
        if (!signature) return false;

        const rawBody = Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload));
        const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
        
        try {
            const actual = String(signature).trim().replace(/^sha256=/i, '');
            const expectedBuffer = Buffer.from(computed, 'hex');
            const actualBuffer = /^[a-f0-9]{64}$/i.test(actual)
                ? Buffer.from(actual, 'hex')
                : Buffer.from(actual);
            return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
        } catch (err) {
            return false;
        }
    }

    async verifyWebhookSignature(rawPayload, headers) {
        const headerName = String(this.settings.webhookHeaderName || this.settings.webhookHeaderKey || 'x-api-key').toLowerCase();
        const normalizedHeaders = Object.keys(headers || {}).reduce((acc, key) => {
            acc[key.toLowerCase()] = headers[key];
            return acc;
        }, {});
        const configuredValue = this._webhookSecret || this.settings.webhookHeaderValue || this._credentials.webhookHeaderValue;
        const receivedValue = normalizedHeaders[headerName];
        const authMode = String(this.settings.webhookAuthMode || 'header').toLowerCase();

        if (authMode === 'hmac') {
            return this.verifySignature(rawPayload, normalizedHeaders['x-shiprocket-signature'], configuredValue);
        }
        if (!configuredValue || !receivedValue) return false;
        const expected = Buffer.from(String(configuredValue));
        const actual = Buffer.from(String(receivedValue));
        return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    }

    async handleWebhook(payload) {
        // Shiprocket sends JSON with diverse naming conventions across courier partners
        const awbCode = String(
            payload.awb ||
            payload.awb_code ||
            payload.awbCode ||
            payload.AWB ||
            ''
        ).trim();

        const status = payload.current_status ||
            payload['current-status'] ||
            payload.shipment_status ||
            payload.status ||
            'unknown';

        const location = payload.current_timestamp_location ||
            payload.current_city ||
            payload['current-city'] ||
            payload.location ||
            '';

        const providerEventId = payload.scan_id ||
            payload.sr_status_id ||
            payload.event_id ||
            payload.id ||
            null;

        const providerOrderId = payload.order_id || payload.shipment_id || payload.provider_order_id || null;

        const timestamp = payload.current_timestamp ||
            payload.scan_date_time ||
            payload.timestamp ||
            payload.date ||
            new Date();

        return {
            providerEventId: providerEventId ? String(providerEventId) : null,
            providerOrderId: providerOrderId ? String(providerOrderId) : null,
            awbCode,
            status: this._normalizeStatus(status),
            location,
            timestamp: Number.isNaN(new Date(timestamp).getTime()) ? new Date() : new Date(timestamp),
            rawPayload: payload,
        };
    }

    _normalizeStatus(srStatus) {
        const s = String(srStatus || '').toLowerCase().replace(/[-_]/g, ' ').trim();
        if (s.includes('rto') && s.includes('delivered')) return 'rto';
        if (s.includes('rto') && s.includes('transit')) return 'rto_in_transit';
        if (s.includes('rto') || s.includes('return')) return 'rto_initiated';
        if (s.includes('delivered')) return 'delivered';
        if (s.includes('out for delivery')) return 'out_for_delivery';
        if (s.includes('packed')) return 'packed';
        if (s.includes('pickup') || s.includes('picked up')) return 'in_transit';
        if (s.includes('in transit') || s.includes('transit') || s.includes('shipped') || s.includes('reached')) return 'in_transit';
        if (s.includes('cancel')) return 'cancelled';
        if (s.includes('failed') || s.includes('undelivered')) return 'delivery_failed';
        return 'unknown';
    }
}

module.exports = ShiprocketProvider;
