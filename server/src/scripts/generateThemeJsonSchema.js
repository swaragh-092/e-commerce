'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { packageSchema } = require('../modules/theme/theme.validation');

const schemaPath = path.resolve(__dirname, '../../../docs/theme-packages/theme-package.schema.json');
const literals = (values = []) => values.filter((value) => value === null || ['string', 'boolean', 'number'].includes(typeof value));

// This projection provides editor diagnostics. The runtime validator still
// handles custom rules, references, input coercion, and API Builder policy.
const generateThemeJsonSchema = () => {
    const definitions = {};
    const references = new Map();

    const nested = (description) => {
        if (!['object', 'array'].includes(description.type)) return convert(description);
        const key = JSON.stringify(description);
        if (!references.has(key)) {
            const id = `schema${references.size + 1}`;
            references.set(key, id);
            definitions[id] = convert(description);
        }
        return { $ref: `#/definitions/${references.get(key)}` };
    };

    const convert = (description) => {
        const { type, flags = {}, rules = [], keys = {}, items = [], allow } = description;
        if (flags.presence === 'forbidden') return false;
        const allowed = literals(allow);
        if (flags.only && allowed.length && !flags.insensitive) return { enum: allowed };

        const schema = {};
        if (['array', 'object', 'string', 'number', 'boolean'].includes(type)) schema.type = type;
        if (type === 'object') {
            schema.properties = Object.fromEntries(Object.entries(keys).map(([key, value]) => [key, nested(value)]));
            const required = Object.keys(keys).filter((key) => keys[key].flags?.presence === 'required');
            if (required.length) schema.required = required;
            if (Object.keys(keys).length || flags.unknown === false || description.patterns) {
                schema.additionalProperties = description.patterns
                    ? { anyOf: description.patterns.map(({ rule }) => nested(rule)) }
                    : flags.unknown === true;
            }
            const conditions = Object.entries(keys).flatMap(([key, entry]) => (entry.whens || []).flatMap((when) => {
                const sibling = when.ref?.path?.[0];
                const values = literals(when.is?.allow);
                if (when.ref?.path?.length !== 1 || !Object.hasOwn(keys, sibling) || !values.length) return [];
                return [{
                    if: { required: [sibling], properties: { [sibling]: { enum: values } } },
                    ...(when.then && { then: { properties: { [key]: nested(when.then) } } }),
                    ...(when.otherwise && { else: { properties: { [key]: nested(when.otherwise) } } }),
                }];
            }));
            if (conditions.length) schema.allOf = conditions;
        }
        if (type === 'array' && items.length) {
            schema.items = items.length === 1 ? nested(items[0]) : { anyOf: items.map(nested) };
        }
        if (type === 'alternatives' && description.matches?.every(({ schema: option }) => option)) {
            schema.anyOf = description.matches.map(({ schema: option }) => nested(option));
        }
        for (const { name, args = {} } of rules) {
            if (name === 'integer') schema.type = 'integer';
            if (name === 'pattern' && typeof args.regex === 'string' && args.regex.endsWith('/')) {
                schema.pattern = args.regex.slice(1, -1);
            }
            if (name === 'min' || name === 'max') {
                const suffix = { string: 'Length', array: 'Items', object: 'Properties' }[type];
                if (suffix) schema[name + suffix] = args.limit;
                else if (type === 'number') schema[name === 'min' ? 'minimum' : 'maximum'] = args.limit;
            }
        }
        if (type === 'array' && flags.single && schema.items) return { anyOf: [schema, schema.items] };
        return allowed.length ? { anyOf: [schema, { enum: allowed }] } : schema;
    };

    const root = convert(packageSchema.describe());
    return { $schema: 'http://json-schema.org/draft-07/schema#', title: 'Swaragh theme package', ...root, definitions };
};

if (require.main === module) fs.writeFileSync(schemaPath, JSON.stringify(generateThemeJsonSchema(), null, 2) + '\n');

module.exports = { generateThemeJsonSchema, schemaPath };
