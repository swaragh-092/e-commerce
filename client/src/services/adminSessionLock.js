let locked = false;

export const isAdminSessionLocked = () => locked;
export const lockAdminSession = () => { locked = true; };
export const unlockAdminSession = () => { locked = false; };

export const getAdminSessionErrorCode = error =>
  error?.response?.data?.error?.code || error?.response?.data?.code;
