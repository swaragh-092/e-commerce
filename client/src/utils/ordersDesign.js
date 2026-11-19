export const safeOrdersLink = (value, fallback = '/products') =>
  typeof value === 'string' && /^\/(?!\/)[^\\\s]*$/.test(value) ? value : fallback;
