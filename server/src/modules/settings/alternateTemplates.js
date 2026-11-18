'use strict';

const Joi = require('joi');

const TEMPLATE_ASSIGNMENT_KEYS = Object.freeze({
  productPage: 'productSlugs',
  categoryPage: 'categorySlugs',
});

const buildAlternateTemplatesSchema = (assignmentKey, settingsSchema = Joi.object().unknown(true)) => (
  Joi.array().items(Joi.object({
    id: Joi.string().uuid().required(),
    name: Joi.string().trim().min(1).max(60).required(),
    [assignmentKey]: Joi.array().items(Joi.string().min(1).max(255)).unique().required(),
    settings: settingsSchema.keys({ alternateTemplates: Joi.forbidden() }).required(),
  })).unique('id').custom((templates, helpers) => {
    const slugs = templates.flatMap((template) => template[assignmentKey]);
    return new Set(slugs).size === slugs.length
      ? templates
      : helpers.message({ custom: 'Each product or category can only be assigned to one template.' });
  })
);

module.exports = { TEMPLATE_ASSIGNMENT_KEYS, buildAlternateTemplatesSchema };
