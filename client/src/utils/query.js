export const buildQueryString = (params = {}, { omitEmpty = false } = {}) => {
  const entries = Object.entries(params).filter(([, value]) => (
    omitEmpty ? value != null && value !== '' : true
  ));
  return new URLSearchParams(entries).toString();
};

export const withQueryString = (path, params = {}, options) => {
  const query = buildQueryString(params, options);
  return `${path}${query ? `?${query}` : ''}`;
};
