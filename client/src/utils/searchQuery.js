const normalizeSearchQuery = (query) => {
  if (typeof query !== 'string') return '';

  return query
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/gu, ' ')
    .trim();
};

export const getSearchQueryLength = (query) => Array.from(normalizeSearchQuery(query)).length;

export default normalizeSearchQuery;
