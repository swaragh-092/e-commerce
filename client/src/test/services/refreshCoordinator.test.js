import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRefreshCoordinator } from '../../services/refreshCoordinator';

// Separate coordinators represent different tabs, sharing an origin lock/store.
function originLock() {
  let tail = Promise.resolve();
  return { request: vi.fn((_key, callback) => {
    const next = tail.then(callback);
    tail = next.catch(() => {});
    return next;
  }) };
}
beforeEach(() => localStorage.clear());
describe('Cross-tab refresh coordination', () => {
  it('refreshes once when two tabs receive 401 for the same credential generation', async () => {
    const locks = originLock();
    const refresh = vi.fn().mockResolvedValue({});
    const a = createRefreshCoordinator({ key: 'test', locks, storage: localStorage, refresh });
    const b = createRefreshCoordinator({ key: 'test', locks, storage: localStorage, refresh });
    const old = a.getVersion();
    await Promise.all([a.ensureFresh(old), b.ensureFresh(old), a.ensureFresh(old)]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(a.getVersion()).toBe(b.getVersion());
    expect(a.getVersion()).not.toBe(old);
  });
  it('does not rotate again for a late 401 issued before another tab refreshed', async () => {
    const refresh = vi.fn();
    const coordinator = createRefreshCoordinator({ key: 'test', locks: originLock(), storage: localStorage, refresh });
    const old = coordinator.getVersion();
    await coordinator.ensureFresh(old);
    await coordinator.ensureFresh(old);
    expect(refresh).toHaveBeenCalledTimes(1);
    await coordinator.ensureFresh(coordinator.getVersion());
    expect(refresh).toHaveBeenCalledTimes(2);
  });
  it('propagates refresh failure and leaves rotation retries fail-closed', async () => {
    const refresh = vi.fn().mockRejectedValue(new Error('expired'));
    const a = createRefreshCoordinator({ key: 'test', locks: originLock(), storage: localStorage, refresh });
    const before = a.getVersion();
    const result = await Promise.allSettled([a.ensureFresh(before), a.ensureFresh(before)]);
    expect(result.every(r => r.status === 'rejected')).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(a.getVersion()).toMatch(/^!pending:/);
  });
  it('does not send a refresh without safe cross-tab coordination', async () => {
    const refresh = vi.fn();
    const a = createRefreshCoordinator({ key: 'test', locks: {}, storage: localStorage, refresh });
    await expect(a.ensureFresh(a.getVersion())).rejects.toMatchObject({ code: 'REFRESH_COORDINATION_UNAVAILABLE' });
    expect(refresh).not.toHaveBeenCalled();
  });
  it('does not change the server session when storage cannot publish a pending generation', async () => {
    let writes = 0;
    const operation = vi.fn();
    const storage = {
      getItem: () => null,
      setItem: () => { writes += 1; throw new Error('denied'); },
    };
    const coordinator = createRefreshCoordinator({ key: 'test', locks: originLock(), storage });
    await expect(coordinator.changeSession(operation)).rejects.toMatchObject({ code: 'REFRESH_COORDINATION_UNAVAILABLE' });
    expect(operation).not.toHaveBeenCalled();
    expect(writes).toBe(1);
  });
  it('restores the prior generation after a definitive rejected login response', async () => {
    let value = 'signed-in-generation|rotation-1';
    const storage = {
      getItem: () => value,
      setItem: (_key, next) => { value = next; },
      removeItem: () => { value = null; },
    };
    const rejection = Object.assign(new Error('Invalid email or password'), { response: { status: 401 } });
    const coordinator = createRefreshCoordinator({ key: 'test', locks: originLock(), storage });
    const before = coordinator.getVersion();

    await expect(coordinator.changeSession(() => Promise.reject(rejection), { restoreOnRejectedLoginResponse: true }))
      .rejects.toBe(rejection);
    expect(coordinator.getVersion()).toBe(before);
  });
  it('keeps an ambiguous failed session change pending', async () => {
    let value = 'signed-in-generation|rotation-1';
    const storage = {
      getItem: () => value,
      setItem: (_key, next) => { value = next; },
      removeItem: () => { value = null; },
    };
    const coordinator = createRefreshCoordinator({ key: 'test', locks: originLock(), storage });

    await expect(coordinator.changeSession(() => Promise.reject(new Error('network timeout')), {
      restoreOnRejectedLoginResponse: true,
    })).rejects.toThrow('network timeout');
    expect(coordinator.getVersion()).toMatch(/^!pending:/);
  });
  it('keeps requests blocked after OAuth failure and through a retry until callback completion', async () => {
    let value = 'prior-generation|prior-rotation';
    const storage = {
      getItem: () => value,
      setItem: (_key, next) => { value = next; },
      removeItem: () => { value = null; },
    };
    const refresh = vi.fn();
    const firstTab = createRefreshCoordinator({ key: 'test', locks: originLock(), storage, refresh });
    const secondTab = createRefreshCoordinator({ key: 'test', locks: originLock(), storage, refresh });
    const priorGeneration = firstTab.getVersion();

    await firstTab.beginSessionChange();
    expect(firstTab.getVersion()).toMatch(/^!pending:oauth:/);
    await expect(secondTab.ensureFresh(priorGeneration)).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    await expect(secondTab.replay(priorGeneration, vi.fn())).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(refresh).not.toHaveBeenCalled();

    await firstTab.beginSessionChange();
    expect(firstTab.getVersion()).toMatch(/^!pending:oauth:/);
    await firstTab.completeSessionChange();
    expect(firstTab.getVersion()).not.toBe(priorGeneration);
    expect(firstTab.getVersion()).not.toMatch(/^!pending:/);
  });
  it('does not let OAuth completion clear an unrelated pending session state', async () => {
    let value = '!pending:refresh-operation';
    const storage = {
      getItem: () => value,
      setItem: (_key, next) => { value = next; },
    };
    const coordinator = createRefreshCoordinator({ key: 'test', locks: originLock(), storage });

    await expect(coordinator.completeSessionChange()).rejects.toMatchObject({ code: 'SESSION_STATE_UNCERTAIN' });
    expect(coordinator.getVersion()).toBe('!pending:refresh-operation');
  });
  it('leaves an uncommitted marker when storage fails after a session change', async () => {
    let value = null;
    let writes = 0;
    const storage = {
      getItem: () => value,
      setItem: (_key, next) => {
        writes += 1;
        if (writes === 2) throw new Error('quota exceeded');
        value = next;
      },
    };
    const operation = vi.fn().mockResolvedValue('signed in');
    const refresh = vi.fn();
    const oldRequestReplay = vi.fn();
    const coordinator = createRefreshCoordinator({ key: 'test', locks: originLock(), storage, refresh });
    const oldGeneration = coordinator.getVersion();

    await expect(coordinator.changeSession(operation)).resolves.toBe('signed in');
    expect(coordinator.getVersion()).toMatch(/^!pending:/);
    await expect(coordinator.replay(oldGeneration, oldRequestReplay)).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    await expect(coordinator.ensureFresh(coordinator.getVersion())).rejects.toMatchObject({ code: 'SESSION_STATE_UNCERTAIN' });
    expect(oldRequestReplay).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
  it('keeps refresh reuse fail-closed when storage cannot publish the completed rotation', async () => {
    let value = null;
    let writes = 0;
    const storage = {
      getItem: () => value,
      setItem: (_key, next) => {
        writes += 1;
        if (writes === 2) throw new Error('quota exceeded');
        value = next;
      },
    };
    const refresh = vi.fn().mockResolvedValue({});
    const coordinator = createRefreshCoordinator({ key: 'test', locks: originLock(), storage, refresh });
    const oldGeneration = coordinator.getVersion();

    await expect(coordinator.ensureFresh(oldGeneration)).rejects.toThrow('quota exceeded');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(coordinator.getVersion()).toMatch(/^!pending:/);
    await expect(coordinator.replay(oldGeneration, vi.fn())).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    await expect(coordinator.ensureFresh(coordinator.getVersion())).rejects.toMatchObject({ code: 'SESSION_STATE_UNCERTAIN' });
  });
  it('does not send a refresh when storage is unavailable', async () => {
    const refresh = vi.fn();
    const storage = { getItem: () => null, setItem: () => { throw new Error('denied'); } };
    const a = createRefreshCoordinator({ key: 'test', locks: originLock(), storage, refresh });
    await expect(a.ensureFresh(null)).rejects.toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });
});

it('serializes logout after rotation and prevents a queued stale request from refreshing again', async () => {
  let finishRefresh;
  const refresh = vi.fn(() => new Promise(resolve => { finishRefresh = resolve; }));
  const locks = originLock();
  const a = createRefreshCoordinator({ key: 'logout-test', locks, storage: localStorage, refresh });
  const b = createRefreshCoordinator({ key: 'logout-test', locks, storage: localStorage, refresh });
  const old = a.getVersion();
  const rotating = a.ensureFresh(old);
  await Promise.resolve();
  const logout = vi.fn();
  const loggingOut = b.changeSession(logout);
  const stale = b.ensureFresh(old);
  expect(logout).not.toHaveBeenCalled();
  finishRefresh();
  const results = await Promise.allSettled([rotating, loggingOut, stale]);
  expect(results[2]).toMatchObject({ status: 'rejected', reason: { code: 'SESSION_CHANGED' } });
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(logout).toHaveBeenCalledTimes(1);
});
