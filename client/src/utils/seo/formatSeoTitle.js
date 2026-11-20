import { DEFAULT_STORE_NAME } from '../store';

export const getSeoSiteName = (settings) => {
  const siteName = String(settings?.seo?.siteName || '').trim();
  return (/^my store$/i.test(siteName) ? '' : siteName)
    || String(settings?.general?.storeName || '').trim() || DEFAULT_STORE_NAME;
};

export const formatSeoTitle = (title, settings = {}) => {
  const seo = settings?.seo || {};
  const storeName = getSeoSiteName(settings);
  const pageTitle = String(title || seo.defaultTitle || storeName).trim();
  const template = String(seo.titleTemplate || '').trim();

  if (pageTitle.toLowerCase() === storeName.toLowerCase()) return pageTitle;
  if (template.includes('%s') && !/^%s\s*\|\s*my store$/i.test(template)) {
    return template.replace(/%s/g, () => pageTitle);
  }

  const configuredSuffix = String(seo.titleSuffix || '').trim();
  const suffix = (/^(?:\|\s*)?my store$/i.test(configuredSuffix) ? '' : configuredSuffix) || `| ${storeName}`;
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
