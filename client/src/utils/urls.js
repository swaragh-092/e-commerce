export const isExternalUrl = (url = '') =>
  /^https?:\/\//i.test(url) || url.startsWith('mailto:') || url.startsWith('tel:');
