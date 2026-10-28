'use strict';

const MAX_TAGS = 50;
const MAX_TAG_LENGTH = 100;
const normalizeTagName = (name) => name.normalize('NFKC').trim().replace(/\s+/gu, ' ');
const tagKey = (name) => normalizeTagName(name).toLowerCase();
const normalizeTagNames = (names) => {
  const unique = new Map();
  for (const name of names) {
    const normalized = normalizeTagName(name);
    const key = tagKey(normalized);
    if (!unique.has(key)) unique.set(key, normalized);
  }
  return [...unique.values()];
};

module.exports = { MAX_TAGS, MAX_TAG_LENGTH, normalizeTagName, normalizeTagNames, tagKey };
