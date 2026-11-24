export const isExternalUrl = (url = '') =>
  /^https?:\/\//i.test(url) || url.startsWith('mailto:') || url.startsWith('tel:');

export const isValidPromoLink = (value = '') => {
  const link = String(value ?? '').trim();
  if (!link) return true;
  if (/[\u0000-\u0020\u007f]/.test(link)) return false;
  if (/^\/(?![\/\\])/.test(link)) return !link.includes('\\');
  if (!/^https?:\/\/[^/\\\s]/i.test(link)) return false;
  try {
    return Boolean(new URL(link).hostname);
  } catch {
    return false;
  }
};
