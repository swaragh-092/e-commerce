import api, { changeAuthSession } from './api';

export const getAdminSession = async () => (await api.get('/auth/admin-session')).data.data;
export const reportAdminActivity = async () => api.post('/auth/admin-session/activity', {});
export const reauthenticateAdmin = async (email, password, reauthContext) =>
  (await changeAuthSession(
    () => api.post('/auth/login', { email, password, rememberMe: false, reauthContext }),
    { restoreOnRejectedLoginResponse: true },
  )).data.data;
