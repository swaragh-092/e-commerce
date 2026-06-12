'use strict';

const sanitizeHtml = require('sanitize-html');
const AppError = require('../../utils/AppError');
const { completeJson } = require('./productAssistant.ai');
const { buildDraftPrompt, buildSpecExtractionPrompt } = require('./productAssistant.prompts');
const { extractTextFromPdfBuffer } = require('./productAssistant.pdf');

const sanitizeLongDescription = (value) => {
  if (!value) return '';
  return sanitizeHtml(value, {
    allowedTags: ['p', 'ul', 'li', 'strong', 'em', 'br'],
    allowedAttributes: {},
  });
};

const sanitizeText = (value, maxLength = 500) => {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
};

const sanitizeArray = (value, maxItems = 8, maxItemLength = 120) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeText(item, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
};

const sanitizeAttributes = (attributes = {}) => ({
  brand: sanitizeText(attributes.brand, 120) || null,
  model: sanitizeText(attributes.model, 120) || null,
  storage: sanitizeText(attributes.storage, 80) || null,
  color: sanitizeText(attributes.color, 80) || null,
  display: sanitizeText(attributes.display, 80) || null,
  sku: sanitizeText(attributes.sku, 100) || null,
  unit: sanitizeText(attributes.unit, 50) || null,
});

const normalizeDraft = (payload = {}, fallbackTitle = '') => ({
  title: sanitizeText(payload.title || payload.normalizedTitle || fallbackTitle, 255),
  shortDescription: sanitizeText(payload.shortDescription, 500),
  longDescription: sanitizeLongDescription(payload.longDescription),
  metaTitle: sanitizeText(payload.metaTitle || payload.title || payload.normalizedTitle || fallbackTitle, 255),
  metaDescription: sanitizeText(payload.metaDescription || payload.shortDescription, 160),
  seoKeywords: sanitizeArray(payload.seoKeywords, 12, 60),
  featureBullets: sanitizeArray(payload.featureBullets, 10, 160),
});

const generateDraft = async (input) => {
  const prompt = buildDraftPrompt(input);
  const raw = await completeJson(prompt);

  return {
    draft: normalizeDraft(raw, input.input),
    attributes: sanitizeAttributes(raw.attributes),
  };
};

const extractSpecsFromPdf = async (file) => {
  if (!file?.buffer) {
    throw new AppError('VALIDATION_ERROR', 400, 'A PDF file is required.');
  }

  const extractedText = extractTextFromPdfBuffer(file.buffer);
  if (!extractedText || extractedText.length < 30) {
    throw new AppError('PDF_TEXT_EXTRACTION_FAILED', 422, 'Could not extract enough text from the PDF spec sheet.');
  }

  const raw = await completeJson(buildSpecExtractionPrompt({
    fileName: file.originalname,
    extractedText,
  }));

  return {
    draft: normalizeDraft(raw, raw.normalizedTitle || file.originalname.replace(/\.pdf$/i, '')),
    attributes: sanitizeAttributes(raw.attributes),
    source: {
      fileName: file.originalname,
      extractedTextLength: extractedText.length,
      textPreview: sanitizeText(extractedText, 400),
    },
  };
};

module.exports = {
  generateDraft,
  extractSpecsFromPdf,
  normalizeDraft,
  sanitizeAttributes,
};
