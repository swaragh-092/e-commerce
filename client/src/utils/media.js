/**
 * Resolves a media path to a full URL.
 * Since both Vite (dev) and Nginx (prod) are configured to proxy '/uploads',
 * we use relative paths. This ensures images load correctly regardless of 
 * whether the app is accessed via localhost, an IP, or a domain.
 */
export const getMediaUrl = (path) => {
  if (!path) return '';
  
  // If the path is already an absolute URL (e.g. from a CDN), return it as-is
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('data:') ||
    path.startsWith('blob:')
  ) {
    return path;
  }

  if (path.startsWith('uploads/')) {
    return `/${path}`;
  }

  if (path.startsWith('/')) {
    return path;
  }

  const looksLikeUploadPath = !path.includes('/') || /^(thumbnails|medium|large)\//.test(path);
  if (looksLikeUploadPath) {
    return `/uploads/${path}`;
  }
  
  // Ensure path starts with / for relative resolution
  const normalizedPath = `/${path}`;
  
  // In development (Vite), if we are not using the proxy for some reason, 
  // you could prepend a base URL here, but given vite.config.js has a proxy,
  // relative paths are best.
  return normalizedPath;
};


const canUseQueryOptimization = (url) => (
  url &&
  !url.startsWith('data:') &&
  !url.startsWith('blob:') &&
  !url.includes('/svg') &&
  !url.toLowerCase().endsWith('.svg')
);

/**
 * Returns an image URL with lightweight transformation hints.
 * CDNs may honor width/quality/format params; local upload handlers can ignore them safely.
 */
export const getOptimizedMediaUrl = (path, options = {}) => {
  const resolved = getMediaUrl(path);
  if (!canUseQueryOptimization(resolved)) return resolved;

  const { width, quality = 82, format = 'auto' } = options;
  const separator = resolved.includes('?') ? '&' : '?';
  const params = [];

  if (width) params.push('w=' + encodeURIComponent(width));
  if (quality) params.push('q=' + encodeURIComponent(quality));
  if (format) params.push('fm=' + encodeURIComponent(format));

  return params.length ? resolved + separator + params.join('&') : resolved;
};

export const imageLoadingProps = ({ priority = false } = {}) => ({
  loading: priority ? 'eager' : 'lazy',
  decoding: priority ? 'sync' : 'async',
  fetchPriority: priority ? 'high' : 'auto',
});
