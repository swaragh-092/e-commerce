// Tokens stay in HttpOnly cookies. This marker identifies a session generation
// and completed rotation so tabs can safely retry without rotating again.
export const createRefreshCoordinator = ({ key, refresh, locks, storage } = {}) => {
  let pending;
  const getStorage = () => storage ?? window.localStorage;
  const getVersion = () => {
    try { return getStorage().getItem(key) || null; } catch { return undefined; }
  };
  const unavailable = () => Object.assign(new Error('Please sign in again; safe session refresh is unavailable in this browser.'), {
    code: 'REFRESH_COORDINATION_UNAVAILABLE',
  });
  const createGeneration = () => {
    const cryptoApi = globalThis.crypto;
    if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
    if (typeof cryptoApi?.getRandomValues === 'function') {
      return Array.from(cryptoApi.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
    }
    throw unavailable();
  };
  const runLocked = (operation, requireLock = true) => {
    const manager = locks ?? globalThis.navigator?.locks;
    if (manager?.request) return manager.request(key, operation);
    // Login/logout still work in older browsers; automatic refresh fails closed.
    return requireLock ? Promise.reject(unavailable()) : Promise.resolve().then(operation);
  };
  const changeSession = (operation, { restoreOnRejectedLoginResponse = false } = {}) => runLocked(async () => {
    const store = getStorage();
    // Publish a distinct, unreadable generation before changing cookies. If
    // storage is read-only or the final write fails, retries fail closed.
    let previousGeneration;
    try { previousGeneration = store.getItem(key); } catch { throw unavailable(); }
    const nextGeneration = createGeneration();
    const pending = `!pending:${createGeneration()}`;
    try { store.setItem(key, pending); } catch { throw unavailable(); }

    let result;
    try {
      result = await operation();
    } catch (error) {
      // A definitive client rejection from login happens before cookies are
      // changed. Restore the prior marker so an already signed-in tab remains
      // usable. Network/server failures remain pending because their outcome
      // may be ambiguous.
      if (restoreOnRejectedLoginResponse && error?.response?.status >= 400 && error.response.status < 500) {
        try {
          if (previousGeneration === null) store.removeItem(key);
          else store.setItem(key, previousGeneration);
        } catch { /* Keep the pending marker if recovery cannot be recorded. */ }
      }
      throw error;
    }
    try { store.setItem(key, `${nextGeneration}|`); } catch { /* Leave the pending marker in place. */ }
    return result;
  }, false);
  const epoch = version => (version || '').split('|')[0];
  const sessionChanged = () => Object.assign(new Error('The signed-in account changed; this request was not retried.'), { code: 'SESSION_CHANGED' });
  const sessionStateUncertain = () => Object.assign(new Error('Session state could not be synchronized; please sign in again.'), { code: 'SESSION_STATE_UNCERTAIN' });
  const isPending = version => typeof version === 'string' && version.startsWith('!pending:');
  const beginSessionChange = () => runLocked(() => {
    const store = getStorage();
    try { store.getItem(key); } catch { throw unavailable(); }
    // OAuth may be retried after a provider failure. Leave this pending until
    // a successful callback commits a new generation; never restore an older
    // generation from a client-controlled error redirect.
    const marker = `!pending:oauth:${createGeneration()}`;
    try { store.setItem(key, marker); } catch { throw unavailable(); }
  }, false);
  const completeSessionChange = () => runLocked(() => {
    const store = getStorage();
    const current = getVersion();
    if (current === undefined) throw unavailable();
    if (!current?.startsWith('!pending:oauth:')) throw sessionStateUncertain();
    store.setItem(key, `${createGeneration()}|`);
  }, false);
  const replay = (observedVersion, operation) => runLocked(() => {
    const current = getVersion();
    if (current === undefined) throw unavailable();
    if (isPending(current) || isPending(observedVersion) || epoch(current) !== epoch(observedVersion)) throw sessionChanged();
    return operation();
  });
  const ensureFresh = (observedVersion) => {
    if (pending) return pending;
    pending = (async () => {
      if (observedVersion === undefined) throw unavailable();
      return runLocked(async () => {
        const current = getVersion();
        if (current === undefined) throw unavailable();
        if (isPending(current) || isPending(observedVersion)) {
          if (current === observedVersion) throw sessionStateUncertain();
          throw sessionChanged();
        }
        if (epoch(current) !== epoch(observedVersion)) throw sessionChanged();
        if (current !== observedVersion) return; // Another tab already refreshed.
        // Publish an in-progress generation before rotating the single-use
        // credential. A failed final write must never leave the old version.
        const store = getStorage();
        const nextRotation = createGeneration();
        const rotationPending = `!pending:${createGeneration()}`;
        store.setItem(key, rotationPending);
        await refresh();
        store.setItem(key, `${epoch(current)}|${nextRotation}`);
      });
    })().finally(() => { pending = null; });
    return pending;
  };
  return {
    getVersion, ensureFresh, changeSession, beginSessionChange,
    completeSessionChange, replay,
  };
};
