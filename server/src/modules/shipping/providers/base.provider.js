'use strict';

/**
 * BaseShippingProvider
 *
 * Every shipping provider adapter MUST extend this class and implement all methods.
 * This guarantees the ShippingService can use any provider interchangeably.
 *
 * WHY a class vs plain interface:
 *  - Lets shared helpers (like logging, credential decryption) live here once.
 *  - Enforces the contract at load time via the abstract method checks below.
 */
class BaseShippingProvider {
    constructor(providerRecord) {
        if (new.target === BaseShippingProvider) {
            throw new Error('BaseShippingProvider is abstract and cannot be instantiated directly.');
        }
        // providerRecord is the ShippingProvider Sequelize model instance.
        // Credentials come from providerRecord.credentialsEncrypted (decrypt as needed).
        this.record = providerRecord;
        this.code = providerRecord.code;
        this.name = providerRecord.name;
        this.settings = providerRecord.settings || {};
    }

    /**
     * Check if a pincode / region is serviceable.
     *
     * @param {object} input
     * @param {string} input.pincode      - Destination pincode
     * @param {string} [input.city]       - Destination city
     * @param {string} [input.state]      - Destination state
     * @param {string} [input.country]    - Destination country (ISO 2-letter)
     * @param {string} [input.pickupPincode] - Pickup/warehouse pincode
     * @param {'prepaid'|'cod'} [input.paymentMode]
     *
     * @returns {Promise<{serviceable: boolean, codAvailable: boolean, reason?: string}>}
     */
    // eslint-disable-next-line no-unused-vars
    async getServiceability(input) {
        throw new Error(`${this.code}.getServiceability() is not implemented.`);
    }

    /**
     * Calculate the shipping rate for a shipment.
     *
     * @param {object} input
     * @param {string} input.pincode
     * @param {string} [input.pickupPincode]
     * @param {number} input.weightGrams   - Total package weight in grams
     * @param {number} [input.lengthCm]
     * @param {number} [input.breadthCm]
     * @param {number} [input.heightCm]
     * @param {number} input.declaredValue - Invoice / order value in INR
     * @param {'prepaid'|'cod'} input.paymentMode
     *
     * @returns {Promise<{
     *   rate: number,
     *   currency: string,
     *   estimatedMinDays: number,
     *   estimatedMaxDays: number,
     *   rawResponse?: object
     * }>}
     */
    // eslint-disable-next-line no-unused-vars
    async calculateRate(input) {
        throw new Error(`${this.code}.calculateRate() is not implemented.`);
    }

    /**
     * Create a shipment with the provider.
     *
     * @param {object} input
     * @param {object} input.order         - Full order object
     * @param {object} input.shipment      - Our Shipment model record
     * @param {object} input.address       - Destination address
     * @param {object[]} input.items       - Array of shipment items
     *
     * @returns {Promise<{
     *   awbCode: string,
     *   providerOrderId?: string,
     *   label?: string,           // base64 or URL
     *   trackingUrl?: string,
     *   rawResponse?: object
     * }>}
     */
    // eslint-disable-next-line no-unused-vars
    async createShipment(input) {
        throw new Error(`${this.code}.createShipment() is not implemented.`);
    }

    /**
     * Cancel a shipment at the provider.
     *
     * @param {object} input
     * @param {string} input.awbCode
     * @param {string} [input.providerOrderId]
     *
     * @returns {Promise<{success: boolean, message?: string, rawResponse?: object}>}
     */
    // eslint-disable-next-line no-unused-vars
    async cancelShipment(input) {
        throw new Error(`${this.code}.cancelShipment() is not implemented.`);
    }

    /**
     * Get live tracking information for a shipment.
     *
     * @param {object} input
     * @param {string} input.awbCode
     *
     * @returns {Promise<{
     *   status: string,
     *   location?: string,
     *   timestamp?: Date,
     *   events?: Array<{status: string, location: string, timestamp: Date, description: string}>,
     *   rawResponse?: object
     * }>}
     */
    // eslint-disable-next-line no-unused-vars
    async getTracking(input) {
        throw new Error(`${this.code}.getTracking() is not implemented.`);
    }

    /**
     * Handle an inbound webhook payload from the provider.
     * Should return a normalised event object the ShippingService can persist.
     *
     * @param {object} payload - Raw webhook body
     *
     * @returns {Promise<{
     *   awbCode: string,
     *   status: string,
     *   location?: string,
     *   timestamp: Date,
     *   rawPayload: object
     * }>}
     */
    // eslint-disable-next-line no-unused-vars
    async handleWebhook(payload) {
        throw new Error(`${this.code}.handleWebhook() is not implemented.`);
    }

    /**
     * Verify the authenticity of an inbound webhook.
     * Uses a constant-time HMAC comparison to prevent timing attacks.
     *
     * @param {object|Buffer} payload
     * @param {string} signature
     * @param {string} secret
     * @returns {Promise<boolean>}
     */
    async verifySignature(payload, signature, secret) {
        if (!secret) {
            console.error(`Verification failed for ${this.code}: No webhook secret configured.`);
            return false;
        }
        if (!signature) {
            console.warn(`Verification failed for ${this.code}: No signature provided in headers.`);
            return false;
        }

        const crypto = require('crypto');
        try {
            // Default implementation assuming standard HMAC-SHA256
            const hmacSource = Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload));
            const expectedSignature = crypto.createHmac('sha256', secret).update(hmacSource).digest('hex');
            
            const expectedBuf = Buffer.from(expectedSignature);
            const actualBuf = Buffer.from(signature);

            if (expectedBuf.length !== actualBuf.length) {
                return false;
            }

            return crypto.timingSafeEqual(expectedBuf, actualBuf);
        } catch (err) {
            console.error(`Error during verifySignature for ${this.code}:`, err);
            return false;
        }
    }
}

module.exports = BaseShippingProvider;
