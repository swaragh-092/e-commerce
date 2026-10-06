'use strict';

const axios = require('axios');
const crypto = require('crypto');
const Joi = require('joi');
const BaseShippingProvider = require('./base.provider');

const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external';
const TOKEN_TTL_MS = 240 * 60 * 60 * 1000;

// Auth failure circuit breaker to prevent repeated failed login attempts
const authFailureCache = new Map();
const AUTH_FAILURE_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

// In-memory serviceability cache to kill N× API latency on repeated or multi-item quotes
const serviceabilityCache = new Map();
const inFlightRequests = new Map();
const SERVICEABILITY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL for success
const UNSERVICEABLE_CACHE_TTL_MS = 30 * 1000; // 30 seconds TTL for deterministic unserviceable

function getAccountNamespace(credentials, record) {
    if (credentials?.email) return String(credentials.email).trim().toLowerCase();
    if (record?.id) return String(record.id).trim();
    return 'default';
}

function setCacheEntry(key, data, isServiceable) {
    if (!data || typeof data !== 'object' || data.rawResponse?.mock) return;
    const ttl = isServiceable ? SERVICEABILITY_CACHE_TTL_MS : UNSERVICEABLE_CACHE_TTL_MS;
    const now = Date.now();
    // 1. Purge expired entries
    for (const [k, v] of serviceabilityCache) {
        if (now >= v.expiresAt) serviceabilityCache.delete(k);
    }
    // 2. Hard-cap at 1000: bounded eviction of oldest entries
    while (serviceabilityCache.size >= 1000) {
        const oldestKey = serviceabilityCache.keys().next().value;
        if (!oldestKey) break;
        serviceabilityCache.delete(oldestKey);
    }
    serviceabilityCache.set(key, { data: { ...data }, expiresAt: now + ttl });
}

function clearServiceabilityCache() {
    serviceabilityCache.clear();
    inFlightRequests.clear();
}

function getAuthCacheKey(credentials) {
    return credentials?.email ? String(credentials.email).trim().toLowerCase() : 'default';
}

function clearAuthCooldown(email) {
    if (email) {
        authFailureCache.delete(String(email).trim().toLowerCase());
    } else {
        authFailureCache.clear();
    }
}

// Shiprocket documents a 50-character maximum for channel order_id and advises
// numeric references. Keep normal IDs readable; long internal parcel IDs are
// mapped deterministically to an 18-digit numeric reference for the carrier.
function toShiprocketOrderId(value) {
    const id = String(value || '').trim();
    if (id.length <= 50) return id;
    const digest = crypto.createHash('sha256').update(id).digest('hex').slice(0, 15);
    return String(BigInt(`0x${digest}`));
}

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

        const cacheKey = getAuthCacheKey(this._credentials);
        const cachedFailure = authFailureCache.get(cacheKey);
        if (cachedFailure && Date.now() < cachedFailure.blockedUntil) {
            const minutesLeft = Math.ceil((cachedFailure.blockedUntil - Date.now()) / (60 * 1000));
            throw new Error(`Shiprocket login suspended: previous authentication failed (${cachedFailure.reason}). Cooldown active for ${minutesLeft} more minute(s).`);
        }

        try {
            const { data } = await axios.post(`${this._baseUrl()}/auth/login`, { email, password });
            
            if (!data || !data.token) {
                throw new Error(`Shiprocket auth failed: ${data?.message || 'Token missing in response'}`);
            }

            authFailureCache.delete(cacheKey);
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
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            if (status === 401 || status === 403 || /unauthorized|invalid credentials|blocked|user not found|wrong password/i.test(message)) {
                authFailureCache.set(cacheKey, {
                    failedAt: Date.now(),
                    reason: message,
                    blockedUntil: Date.now() + AUTH_FAILURE_COOLDOWN_MS,
                });
            }
            throw new Error(`Shiprocket authentication error: ${message}`);
        }
    }

    async testConnection() {
        if (!this._credentials?.email || !this._credentials?.password) {
            return {
                success: false,
                message: 'Shiprocket email and password are not configured.',
            };
        }
        try {
            await this._getToken();
            const response = await this._request({
                method: 'get',
                url: '/settings/company/pickup',
            });
            const locations = response.data?.data?.shipping_address || [];
            return {
                success: true,
                message: `Shiprocket connected successfully. Found ${locations.length} pickup location(s).`,
                locations: locations.map((loc) => ({
                    id: loc.id,
                    pickupLocation: loc.pickup_location,
                    pincode: loc.pin_code,
                    city: loc.city,
                    state: loc.state,
                })),
            };
        } catch (err) {
            return {
                success: false,
                message: `Shiprocket connection failed: ${err.message}`,
            };
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

    async getServiceability({ pincode, pickupPincode, weightGrams = 500, declaredValue = 0, paymentMode = 'prepaid', lengthCm, breadthCm, heightCm, courierCompanyId = null }) {
        const normalizedPincode = String(pincode || '').trim();
        const isIndiaPincode = /^\d{6}$/.test(normalizedPincode);
        if (!isIndiaPincode) {
            return {
                serviceable: false,
                codAvailable: false,
                reason: 'Invalid delivery pincode format (must be 6 digits)',
                rawResponse: { invalidPincode: true, pincode: normalizedPincode },
            };
        }

        // Heavy/oversized parcel check (Edge Case 6)
        const maxWeightKg = Number(this.record?.maxWeightKg) || 20;
        const maxWeightGrams = maxWeightKg * 1000;
        if (weightGrams > maxWeightGrams) {
            return {
                serviceable: false,
                codAvailable: false,
                reason: `Package weight (${(weightGrams / 1000).toFixed(1)}kg) exceeds courier maximum limit (${maxWeightKg}kg). Please reduce item quantity or contact support.`,
                rawResponse: { weightExceeded: true, weightGrams, maxWeightGrams },
            };
        }
        const maxDim = Number(this.record?.maxLengthCm) || 150;
        if ((lengthCm && lengthCm > maxDim) || (breadthCm && breadthCm > maxDim) || (heightCm && heightCm > maxDim)) {
            return {
                serviceable: false,
                codAvailable: false,
                reason: `Package dimensions exceed courier maximum allowed size (${maxDim}cm).`,
                rawResponse: { dimensionExceeded: true },
            };
        }

        if (!this._credentials?.email || !this._credentials?.password) {
            if (!this._mockEnabled()) throw new Error('Shiprocket credentials are not configured. Enable mock mode only for local development.');
            return {
                serviceable: isIndiaPincode,
                codAvailable: true,
                reason: isIndiaPincode ? null : 'Invalid or unserviceable pincode',
                rawResponse: { mock: true, pincode: normalizedPincode },
            };
        }

        const weightKg = Math.max(0.1, weightGrams / 1000);
        const effectivePickup = String(pickupPincode || this.settings.pickupPincode || this.settings.warehousePincode || '').trim();
        const codParam = paymentMode === 'cod' ? 1 : 0;
        const normL = lengthCm && lengthCm > 0 ? Math.ceil(lengthCm) : 0;
        const normB = breadthCm && breadthCm > 0 ? Math.ceil(breadthCm) : 0;
        const normH = heightCm && heightCm > 0 ? Math.ceil(heightCm) : 0;
        const normVal = Number(declaredValue) > 0 ? Math.ceil(Number(declaredValue)) : 0;
        const normCourier = courierCompanyId != null ? String(courierCompanyId).trim() : '';

        const accountNs = getAccountNamespace(this._credentials, this.record);
        const cacheKey = `${accountNs}:${effectivePickup}:${normalizedPincode}:${weightKg}:${normL}:${normB}:${normH}:${codParam}:${normVal}:${normCourier}`;

        const cachedEntry = serviceabilityCache.get(cacheKey);
        if (cachedEntry && Date.now() < cachedEntry.expiresAt) {
            return { ...cachedEntry.data };
        }

        if (inFlightRequests.has(cacheKey)) {
            const inFlightRes = await inFlightRequests.get(cacheKey);
            return { ...inFlightRes };
        }

        const executeRequest = async () => {
            try {
                const res = await this._request({
                    method: 'get',
                    url: '/courier/serviceability/',
                    params: {
                        pickup_postcode: effectivePickup,
                        delivery_postcode: normalizedPincode,
                        weight: weightKg,
                        cod: codParam,
                        ...(normL && normB && normH ? { length: normL, breadth: normB, height: normH } : {}),
                        ...(normVal > 0 ? { declared_value: normVal } : {}),
                    },
                });

                const available = res.data?.data?.available_courier_companies || [];
                let serviceable = available.length > 0;
                let codAvailable = available.some(c => c.cod === 1);
                const pinnedCourier = courierCompanyId == null ? null : available.find((courier) => Number(courier.courier_company_id) === Number(courierCompanyId));
                const recommended = pinnedCourier || available.find((courier) => courier.is_recommended) || available[0] || null;
                if (courierCompanyId != null && !pinnedCourier) {
                    const result = {
                        serviceable: false,
                        codAvailable: false,
                        rate: null,
                        currency: 'INR',
                        courierName: null,
                        courierCompanyId: Number(courierCompanyId),
                        estimatedDeliveryDays: null,
                        reason: paymentMode === 'cod'
                            ? 'The courier selected for this shipment is no longer available for COD on this parcel. Select a new courier or change payment method.'
                            : 'The courier selected for this shipment is no longer available for this parcel. Select a new courier and retry.',
                        rawResponse: res.data,
                    };
                    setCacheEntry(cacheKey, result, false);
                    return result;
                }
                if (paymentMode === 'cod' && pinnedCourier && Number(pinnedCourier.cod) !== 1) {
                    const result = {
                        serviceable: false,
                        codAvailable: false,
                        rate: null,
                        currency: 'INR',
                        courierName: pinnedCourier.courier_name || null,
                        courierCompanyId: Number(courierCompanyId),
                        estimatedDeliveryDays: pinnedCourier.estimated_delivery_days || null,
                        reason: 'The courier selected for this shipment no longer supports COD. Select a new courier or change payment method.',
                        rawResponse: res.data,
                    };
                    setCacheEntry(cacheKey, result, false);
                    return result;
                }

                // Edge Case 4: COD unavailable but prepaid available!
                if (paymentMode === 'cod' && !codAvailable) {
                    try {
                        const prepaidRes = await this._request({
                            method: 'get',
                            url: '/courier/serviceability/',
                            params: {
                                pickup_postcode: effectivePickup,
                                delivery_postcode: normalizedPincode,
                                weight: weightKg,
                                cod: 0,
                                ...(normL && normB && normH ? { length: normL, breadth: normB, height: normH } : {}),
                                ...(normVal > 0 ? { declared_value: normVal } : {}),
                            },
                        });
                        const prepaidCouriers = prepaidRes.data?.data?.available_courier_companies || [];
                        if (courierCompanyId != null && !prepaidCouriers.some((courier) => Number(courier.courier_company_id) === Number(courierCompanyId))) {
                            const result = {
                                serviceable: false,
                                codAvailable: false,
                                rate: null,
                                currency: 'INR',
                                courierName: null,
                                courierCompanyId: Number(courierCompanyId),
                                estimatedDeliveryDays: null,
                                reason: 'The selected courier no longer supports COD for this parcel. Select a new courier or change payment method.',
                                rawResponse: { codAttempt: res.data, prepaidFallback: prepaidRes.data },
                            };
                            setCacheEntry(cacheKey, result, false);
                            return result;
                        }
                        if (prepaidCouriers.length > 0) {
                            const prepaidRecommended = prepaidCouriers.find((courier) => courier.is_recommended) || prepaidCouriers[0];
                            const result = {
                                serviceable: true,
                                codAvailable: false,
                                rate: prepaidRecommended.rate !== null && prepaidRecommended.rate !== undefined && prepaidRecommended.rate !== '' && Number.isFinite(Number(prepaidRecommended.rate)) ? Number(prepaidRecommended.rate) : null,
                                currency: 'INR',
                                courierName: prepaidRecommended.courier_name || null,
                                courierCompanyId: prepaidRecommended.courier_company_id || null,
                                estimatedDeliveryDays: prepaidRecommended.estimated_delivery_days || null,
                                reason: 'Cash on Delivery is unavailable for this pincode, but prepaid delivery is available.',
                                rawResponse: { codAttempt: res.data, prepaidFallback: prepaidRes.data },
                            };
                            setCacheEntry(cacheKey, result, true);
                            return result;
                        }
                    } catch (_) {
                        // Fall through to unserviceable
                    }
                }

                const result = {
                    serviceable,
                    codAvailable,
                    rate: recommended && recommended.rate !== null && recommended.rate !== undefined && recommended.rate !== '' && Number.isFinite(Number(recommended.rate)) ? Number(recommended.rate) : null,
                    currency: 'INR',
                    courierName: recommended?.courier_name || null,
                    courierCompanyId: recommended?.courier_company_id || null,
                    estimatedDeliveryDays: recommended?.estimated_delivery_days || null,
                    reason: serviceable ? null : 'No courier available for this pincode',
                    rawResponse: res.data,
                };
                setCacheEntry(cacheKey, result, serviceable);
                return result;
            } catch (err) {
                console.error('[ShiprocketProvider] getServiceability API error:', err.message);
                const status = err.response?.status;
                if (status === 400 || status === 404 || status === 422) {
                    const result = {
                        serviceable: false,
                        codAvailable: false,
                        reason: err.response?.data?.message || 'Delivery is not available for this pincode.',
                        rawResponse: err.response?.data,
                    };
                    setCacheEntry(cacheKey, result, false);
                    return result;
                }
                throw new Error(`Shiprocket serviceability failed: ${err.response?.data?.message || err.message}`);
            }
        };

        const inFlight = executeRequest();
        inFlightRequests.set(cacheKey, inFlight);
        try {
            return await inFlight;
        } finally {
            inFlightRequests.delete(cacheKey);
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
    async calculateRate({ pincode, pickupPincode, weightGrams = 500, declaredValue = 0, paymentMode = 'prepaid', zone = 'national', packageCount = 1, lengthCm, breadthCm, heightCm }) {
        const maxWeightKg = Number(this.record?.maxWeightKg) || 20;
        const maxWeightGrams = maxWeightKg * 1000;
        if (weightGrams > maxWeightGrams) {
            throw new Error(`Package weight (${(weightGrams / 1000).toFixed(1)}kg) exceeds courier maximum limit (${maxWeightKg}kg).`);
        }

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
                    pickup_postcode:   pickupPincode || this.settings.pickupPincode || this.settings.warehousePincode,
                    delivery_postcode: pincode,
                    weight:            weightKg,
                    cod:               codMode,
                    declared_value:    declaredValue,
                    ...(lengthCm && breadthCm && heightCm ? {
                        length: Math.ceil(lengthCm),
                        breadth: Math.ceil(breadthCm),
                        height: Math.ceil(heightCm),
                    } : {}),
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

    async checkShipmentExists({
        providerRequestId,
        orderNumber,
        courierCompanyId = null,
        pincode,
        pickupPincode,
        weightGrams,
        declaredValue,
        paymentMode,
        lengthCm,
        breadthCm,
        heightCm,
    }) {
        const rawTargetOrderId = String(providerRequestId || orderNumber || '').trim();
        const targetOrderId = toShiprocketOrderId(rawTargetOrderId);
        if (!targetOrderId) return null;

        try {
            // Shiprocket API documents search by order reference: GET /orders?search={channel_order_id}
            // and internal order lookup by Shiprocket order ID: GET /orders/show/{order_id}
            let checkRes = null;
            let existingOrder = null;

            // Search the bounded new reference first, then the historical raw
            // reference so a deployment does not lose reconciliation visibility.
            for (const searchId of [...new Set([targetOrderId, rawTargetOrderId].filter(Boolean))]) {
                try {
                    checkRes = await this._request({
                        method: 'get',
                        url: `/orders?search=${encodeURIComponent(searchId)}`,
                    });
                    const orders = Array.isArray(checkRes?.data?.data) ? checkRes.data.data : (Array.isArray(checkRes?.data) ? checkRes.data : []);
                    existingOrder = orders.find(o => String(o.channel_order_id) === searchId || String(o.id) === searchId) || null;
                    if (existingOrder) break;
                } catch (searchErr) {
                    const searchStatus = searchErr.response?.status || searchErr.status;
                    if (searchStatus !== 404) {
                        // Do not treat network errors or auth failures as "shipment doesn't exist"
                        throw searchErr;
                    }
                }
            }

            // 2. If not found via search and target is numeric, check by Shiprocket internal ID
            if (!existingOrder && /^\d+$/.test(rawTargetOrderId)) {
                try {
                    const showRes = await this._request({
                        method: 'get',
                        url: `/orders/show/${encodeURIComponent(rawTargetOrderId)}`,
                    });
                    existingOrder = showRes?.data?.data || showRes?.data;
                } catch (showErr) {
                    const showStatus = showErr.response?.status || showErr.status;
                    if (showStatus !== 404) {
                        throw showErr;
                    }
                }
            }

            if (!existingOrder || (!existingOrder.id && !existingOrder.shipments?.length)) {
                return null;
            }

            const existingShipment = existingOrder.shipments?.[0] || null;
            const providerOrderId = String(existingOrder.id || targetOrderId);
            const providerShipmentId = String(existingShipment?.id || existingOrder.shipment_id || '');
            if (!providerShipmentId) {
                throw new Error('Order exists on Shiprocket but lacks a shipment ID for recovery.');
            }
            let existingAwb = existingShipment?.awb || existingShipment?.awb_code || existingOrder.awb_code;
            let courierName = existingShipment?.courier_name || null;

            // 1. Assign AWB if not yet assigned
            if (!existingAwb) {
                if (Number(courierCompanyId) > 0) {
                    const serviceability = await this.getServiceability({
                        pincode,
                        pickupPincode,
                        weightGrams,
                        declaredValue,
                        paymentMode,
                        lengthCm,
                        breadthCm,
                        heightCm,
                        courierCompanyId,
                    });
                    if (!serviceability.serviceable || (paymentMode === 'cod' && !serviceability.codAvailable)) {
                        throw new Error(`Pinned courier is no longer serviceable; recovery will not silently change it: ${serviceability.reason || 'courier unavailable'}`);
                    }
                }
                const assignResponse = await this._request({
                    method: 'post',
                    url: '/courier/assign/awb',
                    data: {
                        shipment_id: providerShipmentId,
                        ...(Number(courierCompanyId) > 0 ? { courier_id: Number(courierCompanyId) } : {}),
                    },
                });

                existingAwb = this._providerValue(assignResponse.data, [
                    'awb_code', 'payload.awb_code', 'data.awb_code', 'response.data.awb_code',
                ]);
                courierName = this._providerValue(assignResponse.data, [
                    'courier_name', 'payload.courier_name', 'data.courier_name', 'response.data.courier_name',
                ]);
                if (!existingAwb) {
                    throw new Error('Shiprocket order exists but AWB assignment failed to return an AWB code.');
                }
            }

            // 2. Schedule pickup if not already scheduled (do not swallow pickup failures)
            const pickupAlreadyScheduled = Boolean(
                existingShipment?.pickup_scheduled_date ||
                existingShipment?.pickup_token_number ||
                existingOrder?.pickup_scheduled_date ||
                existingOrder?.pickup_token_number
            );

            if (!pickupAlreadyScheduled && providerShipmentId) {
                try {
                    await this._request({
                        method: 'post',
                        url: '/courier/generate/pickup',
                        data: { shipment_id: [providerShipmentId] },
                    });
                } catch (pickupErr) {
                    const msg = (pickupErr.response?.data?.message || pickupErr.message || '').toLowerCase();
                    if (!msg.includes('already') && !msg.includes('scheduled')) {
                        throw pickupErr;
                    }
                }
            }

            // 3. Generate label if not already present (do not swallow label failures)
            let labelUrl = existingShipment?.label_url || existingOrder?.label_url || null;
            if (!labelUrl && providerShipmentId) {
                const labelResponse = await this._request({
                    method: 'post',
                    url: '/courier/generate/label',
                    data: { shipment_id: [providerShipmentId] },
                });
                labelUrl = this._providerValue(labelResponse?.data, [
                    'label_url', 'payload.label_url', 'data.label_url', 'response.data.label_url',
                ]);
                if (!labelUrl) {
                    throw new Error('Shiprocket did not return a label URL during recovery.');
                }
            }

            // 4. Best-effort invoice and manifest
            let invoiceUrl = existingShipment?.invoice_url || existingOrder?.invoice_url || null;
            let manifestUrl = existingShipment?.manifest_url || existingOrder?.manifest_url || null;

            if (!invoiceUrl && providerOrderId) {
                try {
                    const invoiceResponse = await this._request({
                        method: 'post',
                        url: '/orders/print/invoice',
                        data: { ids: [providerOrderId] },
                    });
                    invoiceUrl = this._providerValue(invoiceResponse?.data, [
                        'invoice_url', 'payload.invoice_url', 'data.invoice_url', 'response.data.invoice_url',
                    ]);
                } catch (_) {
                    // Non-blocking
                }
            }

            if (!manifestUrl && providerShipmentId) {
                try {
                    const manifestResponse = await this._request({
                        method: 'post',
                        url: '/manifests/generate',
                        data: { shipment_id: [providerShipmentId] },
                    });
                    manifestUrl = this._providerValue(manifestResponse?.data, [
                        'manifest_url', 'payload.manifest_url', 'data.manifest_url', 'response.data.manifest_url',
                    ]);
                } catch (_) {
                    // Non-blocking
                }
            }

            // Generate Manifest creates the carrier manifest; Print Manifest
            // produces the individual order's downloadable document. Both are
            // best-effort because Shiprocket may report an existing manifest.
            if (providerOrderId) {
                try {
                    const printableManifest = await this._request({
                        method: 'post',
                        url: '/manifests/print',
                        data: { order_ids: [providerOrderId] },
                    });
                    manifestUrl = this._providerValue(printableManifest?.data, [
                        'manifest_url', 'payload.manifest_url', 'data.manifest_url', 'response.data.manifest_url',
                    ]) || manifestUrl;
                } catch (_) {
                    // Preserve generated manifest link and keep carrier recovery usable.
                }
            }

            return {
                awbCode: String(existingAwb),
                providerOrderId,
                providerShipmentId,
                courierName: courierName || existingShipment?.courier_name || null,
                label: labelUrl || null,
                manifest: manifestUrl || null,
                invoice: invoiceUrl || null,
                trackingUrl: `https://shiprocket.co/tracking/${existingAwb}`,
                rawResponse: existingOrder,
                reconciled: true,
            };
        } catch (err) {
            // Rethrow network, auth, or server errors so callers know recovery check failed
            const status = err.response?.status || err.status;
            if (status === 404) {
                return null;
            }
            throw err;
        }
    }

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
                trackingUrl: `https://shiprocket.co/tracking/${ts}`,
                rawResponse: { message: 'Mock Shiprocket shipment created (credentials not configured)', mock: true },
            };
        }

        if (!line1 || !postalCode || !address.city || !address.state || phone.length !== 10) {
            throw new Error('Shiprocket shipment requires address line, city, state, 6-digit pincode, and a valid 10-digit phone number.');
        }

        // Validate physical measurements (Edge Case 5)
        const actualWeight = Number(shipment.actualWeightGrams || 0);
        if (shipment.hasMissingMeasurements || actualWeight <= 0) {
            if (process.env.NODE_ENV === 'production' || shipment.hasMissingMeasurements) {
                throw new Error('Valid parcel weight and dimensions are required to create a carrier shipment. Missing product measurements cannot use silent defaults.');
            }
        }

        // Courier limits check (Edge Case 6)
        const maxWeightKg = Number(this.record?.maxWeightKg) || 20;
        if (actualWeight > maxWeightKg * 1000) {
            throw new Error(`Package weight (${(actualWeight / 1000).toFixed(1)}kg) exceeds courier maximum allowed limit (${maxWeightKg}kg).`);
        }

        // Reconcile before creating: prevents duplicate shipments if a prior attempt timed out (Edge Case 9)
        const existing = await this.checkShipmentExists({
            providerRequestId: shipment.providerRequestId,
            orderNumber: order.orderNumber,
            courierCompanyId: shipment.courierCompanyId,
            pincode: address.postalCode || address.pincode,
            pickupPincode: shipment.pickupPincode || this.settings.pickupPincode,
            weightGrams: actualWeight,
            declaredValue: order.subtotal,
            paymentMode: order.paymentMethod === 'cod' ? 'cod' : 'prepaid',
            lengthCm: shipment.lengthCm,
            breadthCm: shipment.breadthCm,
            heightCm: shipment.heightCm,
        });
        if (existing && existing.awbCode) {
            return existing;
        }

        const billingEmail = String(order.user?.email || address.email || '').trim();
        if (Joi.string().email().required().validate(billingEmail).error) {
            throw new Error("Shiprocket booking requires the customer's valid email address. Add it to the order before booking.");
        }

        const payload = {
            order_id: toShiprocketOrderId(shipment.providerRequestId || order.orderNumber),
            order_date: new Date(order.createdAt).toISOString().split('T')[0],
            pickup_location: shipment.pickupLocationName || this.settings.pickupLocationName || 'Primary',
            billing_customer_name: firstName,
            billing_last_name: lastName,
            billing_address: line1,
            billing_address_2: line2,
            billing_city: address.city,
            billing_pincode: postalCode,
            billing_state: address.state,
            billing_country: address.country || 'India',
            billing_email: billingEmail,
            billing_phone: phone,
            shipping_is_billing: 1,
            order_items: items.map(i => ({
                name: i.snapshotName || i.name || 'Product',
                sku: i.snapshotSku || i.sku || 'SKU',
                units: i.quantity,
                selling_price: Number(i.unitPrice || 0),
                discount: Number(i.discountAmount || 0),
                tax: Number(i.taxAmount || 0),
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
            weight: Math.max(0.1, (actualWeight || 500) / 1000),
        };

        const { data } = await this._request({ method: 'post', url: '/orders/create/adhoc', data: payload });
        const providerOrderId = String(this._providerValue(data, ['order_id', 'payload.order_id', 'data.order_id']) || payload.order_id);
        const providerShipmentId = this._providerValue(data, ['shipment_id', 'payload.shipment_id', 'data.shipment_id', 'response.data.shipment_id']);
        if (!providerShipmentId) throw new Error('Shiprocket did not return a shipment ID after order creation.');

        const assignResponse = await this._request({
            method: 'post',
            url: '/courier/assign/awb',
            data: {
                shipment_id: providerShipmentId,
                ...(Number(shipment.courierCompanyId) > 0 ? { courier_id: Number(shipment.courierCompanyId) } : {}),
            },
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

        let printableManifestResponse = null;
        try {
            printableManifestResponse = await this._request({
                method: 'post',
                url: '/manifests/print',
                data: { order_ids: [providerOrderId] },
            });
        } catch (_) {
            // The generated manifest remains usable if the per-order print
            // endpoint is unavailable or the carrier has not indexed it yet.
        }

        const label = this._providerValue(labelResponse.data, ['label_url', 'payload.label_url', 'data.label_url', 'response.data.label_url']);
        const invoice = this._providerValue(invoiceResponse.data, ['invoice_url', 'payload.invoice_url', 'data.invoice_url', 'response.data.invoice_url']);
        const manifest = this._providerValue(printableManifestResponse?.data, ['manifest_url', 'payload.manifest_url', 'data.manifest_url', 'response.data.manifest_url'])
            || this._providerValue(manifestResponse.data, ['manifest_url', 'payload.manifest_url', 'data.manifest_url', 'response.data.manifest_url']);

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
                printableManifest: printableManifestResponse?.data || null,
            },
        };
    }

    /* ------------------------------------------------------------------ */
    /* Cancel Shipment                                                        */
    /* ------------------------------------------------------------------ */

    async cancelShipment({ awbCode, providerOrderId }) {
        let response;
        try {
            response = await this._request({
                method: 'post',
                url: '/orders/cancel/shipment/awbs',
                data: { awbs: [awbCode] },
            });
        } catch (error) {
            const status = error?.response?.status;
            const responseMessage = [error?.response?.data?.message, error?.response?.data?.error_description, error?.message]
                .filter(Boolean).join(' ');
            const explicitRouteNotFound = status === 404
                && /(?:route|endpoint|path|url).*(?:not found|unsupported|does not exist)|(?:not found|unsupported|does not exist).*(?:route|endpoint|path|url)/i.test(responseMessage);
            // Only fall back when the endpoint itself is unavailable. A timeout,
            // auth error, or carrier business rejection is ambiguous/meaningful;
            // issuing a second cancellation could conceal the actual outcome.
            if (!(status === 405 || status === 501 || explicitRouteNotFound) || providerOrderId == null) throw error;
            response = await this._request({
                method: 'post',
                url: '/orders/cancel',
                data: { ids: [providerOrderId] },
            });
        }
        const data = response?.data || {};

        // Shiprocket documents a successful cancellation with HTTP 204 and no
        // body; also accept its body-based success responses for older accounts.
        const success = response?.status === 204 || Boolean(data.success) || data.status === 'cancelled' || data.code === 200;

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
        const trackObj = Array.isArray(tracking?.shipment_track) ? tracking.shipment_track[0] : (tracking?.shipment_track || {});
        const activities = tracking?.shipment_track_activities || [];

        // Shipment status codes from https://apidocs.shiprocket.in/ (Tracking).
        // Preserve the local state when a carrier state has no safe equivalent.
        const numericStatusMap = {
            1: 'created',          // AWB_ASSIGNED
            2: 'packed',           // LABEL_GENERATED
            3: 'packed',           // PICKUP_SCHEDULED
            4: 'packed',           // PICKUP_QUEUED
            5: 'packed',           // MANIFEST_GENERATED
            6: 'shipped',          // SHIPPED
            7: 'delivered',        // DELIVERED
            8: 'cancelled',        // CANCELLED
            9: 'rto_initiated',    // RTO_INITIATED
            10: 'rto',             // RTO_DELIVERED
            11: 'created',         // PENDING
            12: 'delivery_failed', // LOST
            13: 'unknown',         // PICKUP_ERROR
            14: 'rto_initiated',   // RTO_ACKNOWLEDGED
            15: 'packed',          // PICKUP_RESCHEDULED
            16: 'unknown',         // CANCELLATION_REQUESTED (not yet cancelled)
            17: 'out_for_delivery',// OUT_FOR_DELIVERY
            18: 'in_transit',      // IN_TRANSIT
            19: 'packed',          // OUT_FOR_PICKUP
            20: 'unknown',         // PICKUP_EXCEPTION
            21: 'delivery_failed', // UNDELIVERED
            22: 'in_transit',      // DELAYED
            23: 'unknown',         // PARTIAL_DELIVERED
            24: 'delivery_failed', // DESTROYED
            25: 'delivery_failed', // DAMAGED
            26: 'unknown',         // FULFILLED (not proof of customer delivery)
            27: 'packed',          // PICKUP_BOOKED
            38: 'in_transit',      // REACHED_DESTINATION_HUB
            39: 'in_transit',      // MISROUTED
            40: 'rto_in_transit',  // RTO_NDR
            41: 'rto_in_transit',  // RTO_OFD
            42: 'in_transit',      // PICKED_UP
            43: 'unknown',         // SELF_FULFILLED
            44: 'delivery_failed', // DISPOSED_OFF
            45: 'cancelled',       // CANCELLED_BEFORE_DISPATCHED
            46: 'rto_in_transit',  // RTO_IN_TRANSIT
            47: 'unknown',         // QC_FAILED
            48: 'in_transit',      // REACHED_WAREHOUSE
            49: 'in_transit',      // CUSTOM_CLEARED
            50: 'in_transit',      // IN_FLIGHT
            51: 'in_transit',      // HANDOVER_TO_COURIER
            52: 'created',         // SHIPMENT_BOOKED
            54: 'in_transit',      // IN_TRANSIT_OVERSEAS
            55: 'in_transit',      // CONNECTION_ALIGNED
            56: 'in_transit',      // REACHED_OVERSEAS_WAREHOUSE
            57: 'in_transit',      // CUSTOM_CLEARED_OVERSEAS
            59: 'packed',          // BOX_PACKING
            60: 'created',         // FC_ALLOCATED
            61: 'created',         // PICKLIST_GENERATED
            62: 'created',         // READY_TO_PACK
            63: 'packed',          // PACKED
            67: 'packed',          // FC_MANIFEST_GENERATED
            68: 'packed',          // PROCESSED_AT_WAREHOUSE
            71: 'unknown',         // HANDOVER_EXCEPTION
            72: 'unknown',         // PACKED_EXCEPTION
            75: 'rto_initiated',   // RTO_LOCK
            76: 'unknown',         // UNTRACEABLE
            77: 'unknown',         // ISSUE_RELATED_TO_THE_RECIPIENT
            78: 'rto_in_transit',  // REACHED_BACK_AT_SELLER_CITY
        };

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
            'RTO OFD': 'rto_in_transit',
            'RTO NDR': 'rto_in_transit',
            'REACHED DESTINATION HUB': 'in_transit',
            'REACHED DESTINATION': 'in_transit',
            'PICKUP COMPLETE': 'shipped',
            'DELIVERY DELAYED': 'in_transit',
            'LOST': 'delivery_failed',
            'DAMAGED': 'delivery_failed',
        };

        const events = activities.map(e => {
            const numStatus = Number(e['sr-status'] || e.status);
            const rawLabel = e['sr-status-label'] || (!Number.isNaN(numStatus) && numericStatusMap[numStatus]) || e.status || '';
            return {
                status: rawLabel,
                location: e.location || '',
                timestamp: e.date ? new Date(e.date) : new Date(),
                description: e.activity || '',
            };
        });
        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Check numeric status codes, string labels, and activity items
        const candidateStatuses = [
            tracking?.shipment_status,
            trackObj?.['sr-status'],
            trackObj?.current_status,
            activities[0]?.['sr-status'],
            activities[0]?.['sr-status-label'],
            activities[0]?.status,
            events[0]?.status,
        ].filter(s => s !== undefined && s !== null && s !== '');

        let mappedStatus = 'unknown';
        for (const candidate of candidateStatuses) {
            const num = Number(candidate);
            if (!Number.isNaN(num) && numericStatusMap[num]) {
                mappedStatus = numericStatusMap[num];
                break;
            }
            const normalizedText = String(candidate).toUpperCase().trim();
            if (statusMap[normalizedText]) {
                mappedStatus = statusMap[normalizedText];
                break;
            }
        }

        return {
            status: mappedStatus,
            location: events[0]?.location || trackObj?.city || '',
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

        const rawTimestamp = payload.current_timestamp ||
            payload.scan_date_time ||
            payload.timestamp ||
            payload.date ||
            null;

        const parsedDate = rawTimestamp ? new Date(rawTimestamp) : null;
        const validTimestamp = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;

        return {
            providerEventId: providerEventId ? String(providerEventId) : null,
            providerOrderId: providerOrderId ? String(providerOrderId) : null,
            awbCode,
            status: this._normalizeStatus(status),
            location,
            timestamp: validTimestamp,
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

ShiprocketProvider.clearAuthCooldown = clearAuthCooldown;
ShiprocketProvider.authFailureCache = authFailureCache;
ShiprocketProvider.AUTH_FAILURE_COOLDOWN_MS = AUTH_FAILURE_COOLDOWN_MS;
ShiprocketProvider.serviceabilityCache = serviceabilityCache;
ShiprocketProvider.inFlightRequests = inFlightRequests;
ShiprocketProvider.clearServiceabilityCache = clearServiceabilityCache;
ShiprocketProvider.toShiprocketOrderId = toShiprocketOrderId;

module.exports = ShiprocketProvider;
