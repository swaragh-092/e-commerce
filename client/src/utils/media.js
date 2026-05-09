/**
 * Resolves a media path to a full URL.
 * Since both Vite (dev) and Nginx (prod) are configured to proxy '/uploads',
 * we use relative paths. This ensures images load correctly regardless of 
 * whether the app is accessed via localhost, an IP, or a domain.
 */
export const getMediaUrl = (path) => {
  if (!path) return '';
  
  // If the path is already an absolute URL (e.g. from a CDN), return it as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Ensure path starts with / for relative resolution
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // In development (Vite), if we are not using the proxy for some reason, 
  // you could prepend a base URL here, but given vite.config.js has a proxy,
  // relative paths are best.
  return normalizedPath;
};
