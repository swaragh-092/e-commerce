let locked = false;
let deadline = 0;

export const isAdminSessionLocked = () => {
  if (deadline && Date.now() >= deadline) locked = true;
  return locked;
};
export const setAdminSessionDeadline = expiresAt => { deadline = expiresAt || 0; };
export const lockAdminSession = () => { locked = true; };
export const unlockAdminSession = () => { locked = false; };

export const getAdminSessionErrorCode = error =>
  error?.response?.data?.error?.code || error?.response?.data?.code;
