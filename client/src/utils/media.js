const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');

/**
 * Resolves a media path to a full URL.
 * If the path is already absolute (http/https), returns it as-is.
 * Otherwise, prepends the server base URL.
 */
export const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${BASE}${path}`;
};
