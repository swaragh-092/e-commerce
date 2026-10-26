'use strict';

const AppError = require('../../utils/AppError');
const normalize = (value) => String(value || '').trim().toLowerCase();
const findUnit = (units, value) => units.find((unit) => normalize(unit.value) === normalize(value)) || units.find((unit) => normalize(unit.label) === normalize(value));

const validateAttributeCategory = (category, settings) => {
    if (!category) return null;
    const registered = settings.categories.find((name) => name.toLowerCase() === category.trim().toLowerCase());
    if (!registered) throw new AppError('VALIDATION_ERROR', 400, 'Choose a registered unit category. Create missing categories in Unit settings.');
    return registered;
};

const validateValueUnit = (attribute, raw, settings, existing) => {
    const value = String(raw || '').trim();
    // Unchanged legacy/hidden units can still be saved when editing other fields.
    if (existing !== undefined && normalize(value) === normalize(existing)) return value || null;
    const category = attribute.unitCategory || findUnit(settings.units, attribute.unit)?.category;
    if (!category) {
        if (!value) return null;
        throw new AppError('VALIDATION_ERROR', 400, 'Choose a unit category on the attribute before adding units to its values.');
    }
    const unit = findUnit(settings.units, value);
    if (!unit || unit.enabled === false || unit.category !== category) {
        throw new AppError('VALIDATION_ERROR', 400, `Choose an available unit from the ${category} category.`);
    }
    return unit.value;
};

const validateCategoryChange = (attribute, category, settings) => {
    if ((attribute.unitCategory || null) === category) return;
    const references = (attribute.values || []).map((value) => value.unitLabel || attribute.unit).filter(Boolean);
    if (references.some((value) => findUnit(settings.units, value)?.category !== category)) {
        throw new AppError('CONFLICT', 409, 'Existing values use units from another category. Remove those values before changing the category.');
    }
};

module.exports = { validateAttributeCategory, validateValueUnit, validateCategoryChange };
