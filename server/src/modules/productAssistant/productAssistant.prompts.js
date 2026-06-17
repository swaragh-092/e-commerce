'use strict';

const buildDraftPrompt = ({ input, tone = 'neutral', includeHtml = true, maxFeatureBullets = 5 }) => ({
  system: [
    'You are an ecommerce product copywriter and product data assistant.',
    'Return valid JSON only with no markdown fences or commentary.',
    'Do not invent hard facts when unsure. Use null or omit uncertain fields.',
    includeHtml
      ? 'Use clean, minimal HTML for longDescription. Allowed tags: p, ul, li, strong, em, br.'
      : 'Use plain text for longDescription.',
  ].join(' '),
  user: JSON.stringify({
    task: 'Generate ecommerce product copy from a short admin product input.',
    input,
    tone,
    maxFeatureBullets,
    outputSchema: {
      title: 'string',
      shortDescription: 'string',
      longDescription: 'string',
      metaTitle: 'string',
      metaDescription: 'string',
      seoKeywords: ['string'],
      featureBullets: ['string'],
      attributes: {
        brand: 'string|null',
        model: 'string|null',
        storage: 'string|null',
        color: 'string|null',
        display: 'string|null',
        sku: 'string|null',
        unit: 'string|null',
      },
    },
  }),
});

const buildSpecExtractionPrompt = ({ fileName, extractedText, maxFeatureBullets = 5 }) => ({
  system: [
    'You extract structured product data from manufacturer spec sheets.',
    'Return valid JSON only with no markdown fences or commentary.',
    'Use only facts supported by the document text.',
    'If a field is not clearly present, return null.',
    'Generate concise ecommerce-friendly copy from the extracted facts.',
  ].join(' '),
  user: JSON.stringify({
    task: 'Extract product attributes and draft admin-ready content from a PDF spec sheet text dump.',
    fileName,
    maxFeatureBullets,
    text: extractedText.slice(0, 18000),
    outputSchema: {
      normalizedTitle: 'string|null',
      attributes: {
        brand: 'string|null',
        model: 'string|null',
        storage: 'string|null',
        color: 'string|null',
        display: 'string|null',
        sku: 'string|null',
        unit: 'string|null',
      },
      shortDescription: 'string|null',
      longDescription: 'string|null',
      metaTitle: 'string|null',
      metaDescription: 'string|null',
      seoKeywords: ['string'],
      featureBullets: ['string'],
    },
  }),
});

module.exports = {
  buildDraftPrompt,
  buildSpecExtractionPrompt,
};
