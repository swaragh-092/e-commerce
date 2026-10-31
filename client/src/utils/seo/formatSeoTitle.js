export const formatSeoTitle = (title, settings = {}) => {
  const seo = settings?.seo || {};
  const storeName = String(seo.siteName || settings?.general?.storeName || 'Store').trim();
  const pageTitle = String(title || seo.defaultTitle || storeName).trim();
  const template = String(seo.titleTemplate || '').trim();

  if (pageTitle.toLowerCase() === storeName.toLowerCase()) return pageTitle;
  if (template.includes('%s')) return template.replace(/%s/g, pageTitle);

  const suffix = String(seo.titleSuffix || '').trim() || `| ${storeName}`;
  return pageTitle.toLowerCase().endsWith(suffix.toLowerCase()) ? pageTitle : `${pageTitle} ${suffix}`;
};

export const resolveCanonicalUrl = ({ url, pathname, settings = {} } = {}) => {
  const candidate = String(url || '').trim();
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  let baseOrigin = browserOrigin || 'http://localhost';
  try {
    const configured = new URL(String(settings?.seo?.canonicalBaseUrl || '').trim());
    if (['http:', 'https:'].includes(configured.protocol)) baseOrigin = configured.origin;
  } catch (_) { /* Use the browser origin for invalid configuration. */ }
  if (candidate) {
    try {
      const parsed = new URL(candidate, baseOrigin);
      if (['http:', 'https:'].includes(parsed.protocol)) return `${parsed.origin}${parsed.pathname}`;
    }
    catch (_) { /* Use the configured origin and current route below. */ }
  }

  return new URL(pathname || '/', baseOrigin).toString();
};
