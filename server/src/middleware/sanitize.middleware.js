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

const sanitizeBody = () => {
    return (req, res, next) => {
        next();
    };
};

module.exports = {
  sanitizeRichText,
  sanitizePlainText,
  sanitizeBody
};
