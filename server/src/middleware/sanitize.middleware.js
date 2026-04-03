'use strict';

const sanitizeHtml = require('sanitize-html');

const sanitizeRichText = (html) => {
  if (!html) return html;
  return sanitizeHtml(html, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'img'],
    allowedAttributes: { 'a': ['href'], 'img': ['src', 'alt'] }
  });
};

const sanitizePlainText = (text) => {
  if (!text) return text;
  return sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });
};

/**
 * Recursively strips HTML tags from all string values in an object/array.
 * Leaves non-string, non-object values untouched.
 */
const deepSanitize = (value) => {
    if (typeof value === 'string') {
        return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
    }
    if (Array.isArray(value)) {
        return value.map(deepSanitize);
    }
    if (value !== null && typeof value === 'object') {
        const sanitized = {};
        for (const [k, v] of Object.entries(value)) {
            sanitized[k] = deepSanitize(v);
        }
        return sanitized;
    }
    return value;
};

/**
 * Express middleware: sanitizes all string fields in req.body to strip
 * HTML injection. Replaces the previous no-op implementation.
 */
const sanitizeBody = () => {
    return (req, res, next) => {
        if (req.body && typeof req.body === 'object') {
            req.body = deepSanitize(req.body);
        }
        next();
    };
};

module.exports = {
  sanitizeRichText,
  sanitizePlainText,
  sanitizeBody
};
