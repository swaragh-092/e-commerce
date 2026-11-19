let locked = false;
let deadline = 0;
let guardCount = 0;
let guardReleaseTimer;

export const activateAdminSessionGuard = () => {
  clearTimeout(guardReleaseTimer);
  guardCount += 1;
  return () => {
    guardCount = Math.max(0, guardCount - 1);
    if (guardCount) return;
    guardReleaseTimer = setTimeout(() => {
      if (guardCount) return;
      resetAdminSessionLock();
    }, 0);
  };
};
export const isAdminSessionGuardActive = () => guardCount > 0;
export const resetAdminSessionLock = () => { locked = false; deadline = 0; };

export const isAdminSessionLocked = () => {
  if (deadline && Date.now() >= deadline) locked = true;
  return locked;
};
export const setAdminSessionDeadline = expiresAt => { deadline = expiresAt || 0; };
export const lockAdminSession = () => { locked = true; };
export const unlockAdminSession = () => { locked = false; };

export const getAdminSessionErrorCode = error =>
  error?.response?.data?.error?.code || error?.response?.data?.code;
