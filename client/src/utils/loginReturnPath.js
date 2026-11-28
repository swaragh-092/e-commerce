import { createPath } from 'react-router-dom';

const OAUTH_RETURN_PATH_KEY = 'storefront:oauth-return-path';

const localPath = (path) => {
  if (!path?.startsWith('/') || path.startsWith('//')) return null;
  const url = new URL(path, window.location.origin);
  return url.origin === window.location.origin && !url.pathname.startsWith('//') ? createPath(url) : null;
};

export const getLoginReturnPath = (from) => from?.pathname ? localPath(createPath(from)) : null;

export const saveOAuthReturnPath = (path) => {
  try {
    if (path) window.sessionStorage.setItem(OAUTH_RETURN_PATH_KEY, path);
    else window.sessionStorage.removeItem(OAUTH_RETURN_PATH_KEY);
  } catch { /* Sign-in still works when storage is unavailable. */ }
};

export const takeOAuthReturnPath = () => {
  try {
    const path = window.sessionStorage.getItem(OAUTH_RETURN_PATH_KEY);
    window.sessionStorage.removeItem(OAUTH_RETURN_PATH_KEY);
    return localPath(path);
  } catch {
    return null;
  }
};
