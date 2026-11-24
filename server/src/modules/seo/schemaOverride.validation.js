'use strict';

const Joi = require('joi');
const { parseSchemaOverride, schemaTypes } = require('./schemaOverride');

const schemaOverrideField = (kind) => Joi.string().trim().max(12000).allow(null, '').custom((value, helpers) => (
  parseSchemaOverride(value, kind) ? value : helpers.error('any.invalid')
)).messages({
  'any.invalid': `Enter one JSON-LD object with a name and @type ${schemaTypes[kind].join(' or ')}. If supplied, @context must be https://schema.org.`,
});

module.exports = { schemaOverrideField };
