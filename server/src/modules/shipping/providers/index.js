'use strict';

const ManualProvider = require('./manual.provider');
const ShiprocketProvider = require('./shiprocket.provider');
const EkartProvider = require('./ekart.provider');

/**
 * PROVIDER_MAP
 *
 * Maps ShippingProvider.code (stored in DB) → Adapter class.
 *
 * WHY a static map instead of dynamic require:
 *   - No filesystem scanning at runtime.
 *   - New providers are added here explicitly — avoids accidental code injection.
 *   - Easy to grep for all supported providers.
 *
 * To add a new provider:
 *   1. Create providers/<name>.provider.js extending BaseShippingProvider.
 *   2. Add an entry here.
 *   3. Insert a matching row in shipping_providers (via migration or seed).
 */
const PROVIDER_MAP = {
    default: ManualProvider,
    manual: ManualProvider,
    shiprocket: ShiprocketProvider,
    ekart: EkartProvider,
    // delhivery:  DelhiveryProvider,  // add when ready
};

/**
 * Resolve a ShippingProvider DB record to its adapter instance.
 *
 * @param {object} providerRecord - Sequelize ShippingProvider instance
 * @returns {BaseShippingProvider}
 */
const resolveProvider = (providerRecord) => {
    const code = (providerRecord?.code || 'default').toLowerCase();
    const AdapterClass = PROVIDER_MAP[code] || ManualProvider;
    return new AdapterClass(providerRecord);
};

module.exports = { resolveProvider, PROVIDER_MAP };
