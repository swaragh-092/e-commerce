// Hide local links to disabled storefront features, including legacy HTML URLs.
export const getNavigationFeature = (url, origin = globalThis.location?.origin || 'http://localhost') => {
  if (!url || String(url).startsWith('#')) return null;
  try {
    const parsed = new URL(url, origin);
    if (parsed.origin !== origin) return null;
    const path = parsed.pathname.toLowerCase();
    if (/^\/p(?:\/|$)/.test(path)) return 'pages';
    if (/^\/tags(?:\/|$)/.test(path)) return 'tags';
    if (/^\/brands(?:\/|$)/.test(path)) return 'brands';
    if (/^\/blogs(?:\/|$)/.test(path) || /\/blog(?:-details)?\.html$/.test(path)) return 'blogs';
    if (/^\/gallery(?:\/|$)/.test(path) || /\/gallery\.html$/.test(path)) return 'gallery';
  } catch { /* Keep unrelated custom links; URL validation is handled by the menu editor. */ }
  return null;
};

export const filterFeatureLinks = (items = [], features = {}) => items
  .filter((item) => {
    const feature = getNavigationFeature(item.url);
    return !feature || features[feature] === true;
  })
  .map((item) => Array.isArray(item.children)
    ? { ...item, children: filterFeatureLinks(item.children, features) }
    : item)
  .filter((item) => !(item.targetType === 'none' && item.children?.length === 0));
