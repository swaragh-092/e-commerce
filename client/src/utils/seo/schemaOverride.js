const schemaTypes = { product: ['Product', 'ProductGroup'], category: ['CollectionPage'] };
const context = 'https://schema.org';

export function parseSchemaOverride(value, kind) {
  try {
    const schema = JSON.parse(value);
    if (!schema || !schemaTypes[kind]?.includes(schema['@type']) ||
        (schema['@context'] !== undefined && schema['@context'] !== context) ||
        '@graph' in schema || typeof schema.name !== 'string' || !schema.name.trim()) return null;
    return { '@context': context, ...schema };
  } catch {
    return null;
  }
}

export function validateSchemaOverride(value, kind) {
  if (value.trim().length > 12000) return 'Custom JSON-LD must be 12,000 characters or fewer.';
  if (!value.trim() || parseSchemaOverride(value, kind)) return '';
  return `Enter one JSON-LD object with a name and @type ${schemaTypes[kind].join(' or ')}. If supplied, @context must be https://schema.org.`;
}
