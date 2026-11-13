import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
let api;
const denied = config => Object.assign(new Error('Unauthorized'), { config, response: { status: 401, data: {} } });
beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  let tail = Promise.resolve();
  vi.stubGlobal('navigator', { locks: { request: (_key, cb) => {
    const next = tail.then(cb); tail = next.catch(() => {}); return next;
  } } });
  api = (await import('../../services/api')).default;
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('API refresh retry behavior', () => {
  it.each(['enable', 'disable'])('releases the MFA lock before expired authentication recovery for %s', async action => {
    const refresh = vi.spyOn(axios, 'post').mockResolvedValue({ status: 200 });
    const service = (await import('../../services/authService')).default;
    let attempts = 0;
    api.defaults.adapter = vi.fn(async config => {
      if (config.url === `/auth/2fa/${action}` && ++attempts === 1) throw denied(config);
      if (config.url === '/users/me' && !config._retry) throw denied(config);
      return { data: { data: { enabled: action === 'enable' } }, status: 200, headers: {}, config };
    });
    await service[action === 'enable' ? 'enable2FA' : 'disable2FA']('123456');
    expect(attempts).toBe(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('shares refresh for concurrent expired requests and retries each once', async () => {
    const refresh = vi.spyOn(axios, 'post').mockResolvedValue({ status: 200 });
    api.defaults.adapter = vi.fn(async config => {
      if (!config._retry) throw denied(config);
      return { data: { ok: true }, status: 200, headers: {}, config };
    });
    const results = await Promise.all([api.get('/users/me'), api.get('/orders')]);
    expect(results.every(result => result.data.ok)).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(api.defaults.adapter).toHaveBeenCalledTimes(4);
  });
  it('stops after one retry when the refreshed request is still unauthorized', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({ status: 200 });
    const unauthorized = vi.fn();
    window.addEventListener('auth:unauthorized', unauthorized);
    api.defaults.adapter = vi.fn(async config => { throw denied(config); });
    await expect(api.get('/users/me')).rejects.toThrow('Unauthorized');
    expect(api.defaults.adapter).toHaveBeenCalledTimes(2);
    expect(unauthorized).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth:unauthorized', unauthorized);
  });
  it('does not replay a stale request under a newly signed-in account', async () => {
    const refresh = vi.spyOn(axios, 'post').mockResolvedValue({});
    localStorage.setItem('userProfile', 'new-account');
    api.defaults.adapter = vi.fn(async config => {
      if (!config._retry) {
        localStorage.setItem(`auth:refresh-generation:${api.defaults.baseURL}`, 'session-change:new-account');
        throw denied(config);
      }
      return { data: {}, status: 200, headers: {}, config };
    });
    await expect(api.get('/orders')).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(api.defaults.adapter).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(localStorage.getItem('userProfile')).toBe('new-account');
  });
  it('does not refresh when a login or MFA code is rejected', async () => {
    const refresh = vi.spyOn(axios, 'post').mockResolvedValue({});
    api.defaults.adapter = vi.fn(async config => { throw denied(config); });
    await expect(api.post('/auth/login', {})).rejects.toThrow('Unauthorized');
    await expect(api.post('/auth/2fa/verify', {})).rejects.toThrow('Unauthorized');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('locks admin sessions without clearing auth or replaying the expired request', async () => {
    const refresh = vi.spyOn(axios, 'post').mockResolvedValue({ status: 200 });
    localStorage.setItem('userProfile', JSON.stringify({ id: 'admin-1' }));
    const expired = Object.assign(new Error('Admin session expired'), {
      response: { status: 401, data: { code: 'ADMIN_SESSION_EXPIRED' } },
    });
    api.defaults.adapter = vi.fn(async config => { expired.config = config; throw expired; });
    const onExpired = vi.fn();
    window.addEventListener('admin-session:expired', onExpired);
    await expect(api.put('/admin/products/1', { name: 'unsaved' })).rejects.toBe(expired);
    window.removeEventListener('admin-session:expired', onExpired);
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(localStorage.getItem('userProfile')).toBe(JSON.stringify({ id: 'admin-1' }));
  });
});
