'use strict';

const MAX_SEARCH_QUERY_LENGTH = 100;

const normalizeSearchQuery = (query) => {
  if (typeof query !== 'string') return '';

  return query
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/gu, ' ')
    .trim();
};

const buildSearchPattern = (query) => `%${query.replace(/[\\%_]/g, '\\$&')}%`;

module.exports = {
  MAX_SEARCH_QUERY_LENGTH,
  normalizeSearchQuery,
  buildSearchPattern,
};
