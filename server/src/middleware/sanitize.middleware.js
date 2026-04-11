'use strict';

const sanitizeHtml = require('sanitize-html');

const sanitizeRichText = (html) => {
  if (!html) return html;
  return sanitizeHtml(html, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'img'],
    allowedAttributes: { 'a': ['href'], 'img': ['src', 'alt'] }
  });
};

/**
 * A more permissive sanitizer for admin-controlled page content.
 * Allows full block-level HTML (divs, tables, headings, spans etc.)
 * while still blocking dangerous elements (script, iframe, object).
 */
const sanitizePageContent = (html) => {
  if (!html) return html;
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'b', 'i', 'u', 'em', 'strong', 's', 'strike', 'sub', 'sup',
      'p', 'br', 'blockquote', 'pre', 'code',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
      'div', 'span', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main',
      'figure', 'figcaption',
      'img', 'a', 'hr',
    ]),
    allowedAttributes: {
      '*': ['class', 'id', 'style', 'data-*'],
      'a': ['href', 'target', 'rel'],
      'img': ['src', 'alt', 'width', 'height'],
      'td': ['colspan', 'rowspan'],
      'th': ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    // Allow style attributes but strip dangerous CSS
    allowedStyles: {
      '*': {
        'color': [/.*/],
        'background-color': [/.*/],
        'text-align': [/^(left|center|right|justify)$/],
        'font-size': [/.*/],
        'font-weight': [/.*/],
        'font-style': [/.*/],
        'text-decoration': [/.*/],
        'margin': [/.*/],
        'padding': [/.*/],
        'width': [/.*/],
        'height': [/.*/],
        'display': [/.*/],
      },
    },
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
  sanitizePageContent,
  sanitizePlainText,
  sanitizeBody
};
