import axios from 'axios';
import { getSessionId } from './session';
import { createRefreshCoordinator } from './refreshCoordinator';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshCoordinator = createRefreshCoordinator({
  key: `auth:refresh-generation:${api.defaults.baseURL}`,
  refresh: () => axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true, timeout: 15000 }),
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

api.interceptors.request.use(
  (config) => {
    config._authRefreshVersion = refreshCoordinator.getVersion();
    try {
      if (config && config.headers && !config.headers['X-Session-Id'] && !config.headers['x-session-id']) {
        const sessionId = getSessionId();
        if (sessionId) {
          config.headers['X-Session-Id'] = sessionId;
        }
      }
    } catch (_) {}
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

    if (error.response?.status === 401 && error.response?.data?.code === 'ADMIN_SESSION_EXPIRED') {
      window.dispatchEvent(new CustomEvent('admin-session:expired'));
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
        if (refreshError.code !== 'SESSION_CHANGED') clearSession(refreshError);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
