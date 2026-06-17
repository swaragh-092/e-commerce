'use strict';

const normalizeDateOnly = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        return value.toISOString().slice(0, 10);
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
};

const isDateOnOrAfter = (value, minimum) => {
    const normalizedValue = normalizeDateOnly(value);
    const normalizedMinimum = normalizeDateOnly(minimum);
    if (!normalizedValue || !normalizedMinimum) return false;
    return normalizedValue >= normalizedMinimum;
};

module.exports = {
    normalizeDateOnly,
    isDateOnOrAfter,
};
