import api from './api';

export const getAdminSession = async () => (await api.get('/auth/admin-session', { skipAuthRefresh: true })).data.data;
export const reportAdminActivity = async () => api.post('/auth/admin-session/activity', {}, { skipAuthRefresh: true });
