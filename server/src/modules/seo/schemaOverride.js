'use strict';

const SCHEMA_CONTEXT = 'https://schema.org';
const schemaTypes = { product: ['Product', 'ProductGroup'], category: ['CollectionPage'] };
const priceKeys = new Set(['offers', 'price', 'priceCurrency', 'priceSpecification', 'lowPrice', 'highPrice', 'availability']);

function parseSchemaOverride(value, kind, { includePricing = true } = {}) {
  if (!value) return null;
  try {
    const schema = JSON.parse(value, (key, entry) => {
      if (includePricing) return entry;
      const type = entry?.['@type'];
      const types = Array.isArray(type) ? type : [type];
      if (priceKeys.has(key) || types.some((name) => ['Offer', 'AggregateOffer', 'PriceSpecification'].includes(name))) return undefined;
      return entry;
    });
    if (!schema || !schemaTypes[kind]?.includes(schema['@type']) ||
        (schema['@context'] !== undefined && schema['@context'] !== SCHEMA_CONTEXT) ||
        '@graph' in schema || typeof schema.name !== 'string' || !schema.name.trim()) return null;
    return { '@context': SCHEMA_CONTEXT, ...schema };
  } catch {
    return null;
  }
}

module.exports = { parseSchemaOverride, schemaTypes };
