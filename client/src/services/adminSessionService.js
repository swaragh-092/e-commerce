import api from './api';

export const getAdminSession = async () => (await api.get('/auth/admin-session')).data.data;
export const reportAdminActivity = async () => api.post('/auth/admin-session/activity', {});
export const reauthenticateAdmin = async (email, password, reauthContext) =>
  (await api.post('/auth/login', { email, password, rememberMe: false, reauthContext })).data.data;
