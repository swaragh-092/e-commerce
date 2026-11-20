import axios from 'axios';
import { getSessionId } from './session';
import { createRefreshCoordinator } from './refreshCoordinator';
import { getAdminSessionErrorCode, isAdminSessionGuardActive, isAdminSessionLocked, lockAdminSession } from './adminSessionLock';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const safeMethods = new Set(['get', 'head', 'options']);
let csrfTokenPromise;

function getCsrfToken() {
  csrfTokenPromise ||= axios.get(`${api.defaults.baseURL}/csrf-token`, {
    withCredentials: true,
    timeout: 15000,
  }).then(({ data }) => data.token).catch((error) => {
    csrfTokenPromise = undefined;
    throw error;
  });
  return csrfTokenPromise;
}

const isCsrfRejection = (error) => error.response?.status === 403 &&
  error.response.data?.error?.code === 'CSRF_TOKEN_INVALID';

async function refreshAuth() {
  const send = async () => axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, {
    withCredentials: true, timeout: 15000, headers: { 'X-CSRF-Token': await getCsrfToken() },
  });
  try {
    return await send();
  } catch (error) {
    if (!isCsrfRejection(error)) throw error;
    csrfTokenPromise = undefined;
    return send();
  }
}

const refreshCoordinator = createRefreshCoordinator({
  key: `auth:refresh-generation:${api.defaults.baseURL}`,
  refresh: refreshAuth,
});
export const changeAuthSession = (operation, options) => refreshCoordinator.changeSession(operation, options);
export const beginAuthSessionChange = () => refreshCoordinator.beginSessionChange();
export const completeAuthSessionChange = () => refreshCoordinator.completeSessionChange();
const clearedErrors = new WeakSet();
const clearSession = error => {
  if (error && typeof error === 'object') {
    if (clearedErrors.has(error)) return;
    clearedErrors.add(error);
  }
  try { localStorage.removeItem('userProfile'); } catch { /* Storage may be unavailable. */ }
  window.dispatchEvent(new Event('auth:unauthorized'));
};
const handleAdminSessionExpiry = error => {
  if (error?.response?.status !== 401 || getAdminSessionErrorCode(error) !== 'ADMIN_SESSION_EXPIRED') return false;
  lockAdminSession();
  window.dispatchEvent(new CustomEvent('admin-session:expired'));
  return true;
};

api.interceptors.request.use(
  async (config) => {
    const authEndpoint = ['/auth/login', '/auth/2fa/', '/auth/otp/verify', '/auth/logout']
      .some(path => config.url?.includes(path));
    const adminStatusEndpoint = config.url?.replace(/\?.*$/, '') === '/auth/admin-session';
    if (isAdminSessionGuardActive() && isAdminSessionLocked() && !authEndpoint && !adminStatusEndpoint) {
      window.dispatchEvent(new CustomEvent('admin-session:expired'));
      return Promise.reject(Object.assign(new Error('Admin session is locked; request was not sent.'), { code: 'ADMIN_SESSION_LOCKED', config }));
    }
    config._authRefreshVersion = refreshCoordinator.getVersion();
    try {
      if (config && config.headers && !config.headers['X-Session-Id'] && !config.headers['x-session-id']) {
        const sessionId = getSessionId();
        if (sessionId) {
          config.headers['X-Session-Id'] = sessionId;
        }
      }
    } catch (_) {}
    if (!safeMethods.has((config.method || 'get').toLowerCase())) {
      config.headers['X-CSRF-Token'] = await getCsrfToken();
      if (config._authRefreshVersion !== refreshCoordinator.getVersion()) {
        throw Object.assign(new Error('Authentication session changed; request was not sent.'), { code: 'SESSION_CHANGED' });
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (originalRequest && !originalRequest._csrfRetry && isCsrfRejection(error) &&
        originalRequest._authRefreshVersion === refreshCoordinator.getVersion()) {
      originalRequest._csrfRetry = true;
      csrfTokenPromise = undefined;
      return api(originalRequest);
    }

    if (error.response?.status === 401 && getAdminSessionErrorCode(error) === 'ADMIN_SESSION_EXPIRED') {
      handleAdminSessionExpiry(error);
      return Promise.reject(error);
    }

    const authEndpoint = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/2fa/verify', '/auth/otp/verify']
      .some(path => originalRequest?.url?.includes(path));
    if (error.response?.status === 401 && originalRequest && !authEndpoint && !originalRequest.skipAuthRefresh) {
      if (originalRequest._retry) {
        clearSession(error);
        return Promise.reject(error);
      }
      originalRequest._retry = true;
      try {
        await refreshCoordinator.ensureFresh(originalRequest._authRefreshVersion);
        originalRequest.timeout ||= 15000;
        return await refreshCoordinator.replay(originalRequest._authRefreshVersion, () => api(originalRequest));
      } catch (refreshError) {
        const adminLocked = isAdminSessionGuardActive() && isAdminSessionLocked();
        if (!handleAdminSessionExpiry(refreshError) && refreshError.code !== 'SESSION_CHANGED' && !adminLocked) clearSession(refreshError);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
