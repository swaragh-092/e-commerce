'use strict';

const zlib = require('zlib');

const OCTAL_ESCAPE_RE = /\\([0-7]{1,3})/g;
const SIMPLE_ESCAPES = {
  '\\n': '\n',
  '\\r': '\r',
  '\\t': '\t',
  '\\b': '\b',
  '\\f': '\f',
  '\\(': '(',
  '\\)': ')',
  '\\\\': '\\',
};

const decodePdfString = (value = '') => {
  let text = value.replace(OCTAL_ESCAPE_RE, (_, octal) => String.fromCharCode(parseInt(octal, 8)));

  Object.entries(SIMPLE_ESCAPES).forEach(([encoded, decoded]) => {
    text = text.split(encoded).join(decoded);
  });

  return text;
};

const collectTextFromContent = (content) => {
  const parts = [];
  const textOperators = [...content.matchAll(/\((?:\\.|[^\\()])*\)\s*Tj/g)];
  const arrayOperators = [...content.matchAll(/\[(.*?)\]\s*TJ/gs)];

  textOperators.forEach((match) => {
    const raw = match[0].replace(/\)\s*Tj$/, '').slice(1);
    const decoded = decodePdfString(raw).trim();
    if (decoded) parts.push(decoded);
  });

  arrayOperators.forEach((match) => {
    const arrayText = match[1];
    const nested = [...arrayText.matchAll(/\((?:\\.|[^\\()])*\)/g)];
    nested.forEach((entry) => {
      const decoded = decodePdfString(entry[0].slice(1, -1)).trim();
      if (decoded) parts.push(decoded);
    });
  });

  if (parts.length > 0) {
    return parts.join('\n');
  }

  const looseStrings = [...content.matchAll(/\((?:\\.|[^\\()]){2,}\)/g)];
  return looseStrings
    .map((match) => decodePdfString(match[0].slice(1, -1)).trim())
    .filter(Boolean)
    .join('\n');
};

const inflateStream = (buffer) => {
  try {
    return zlib.inflateSync(buffer);
  } catch (_) {
    try {
      return zlib.inflateRawSync(buffer);
    } catch (_) {
      return null;
    }
  }
};

const extractTextFromPdfBuffer = (buffer) => {
  const source = buffer.toString('latin1');
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  const chunks = [];
  let match;

  while ((match = streamRe.exec(source)) !== null) {
    const rawContent = match[1];
    const streamStart = match.index;
    const dictStart = Math.max(0, source.lastIndexOf('<<', streamStart));
    const dictEnd = source.indexOf('>>', dictStart);
    const dict = dictStart >= 0 && dictEnd >= 0 ? source.slice(dictStart, dictEnd + 2) : '';
    const rawBuffer = Buffer.from(rawContent, 'latin1');
    const decodedBuffer = /\/FlateDecode/.test(dict) ? inflateStream(rawBuffer) : rawBuffer;

    if (!decodedBuffer) continue;

    const text = collectTextFromContent(decodedBuffer.toString('latin1'));
    if (text) chunks.push(text);
  }

  const extracted = chunks.join('\n').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  if (extracted) {
    return extracted;
  }

  return source
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

module.exports = {
  extractTextFromPdfBuffer,
};
