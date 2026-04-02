import api from './api';

const authService = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.data.tokens) {
      localStorage.setItem('accessToken', response.data.data.tokens.accessToken);
      localStorage.setItem('refreshToken', response.data.data.tokens.refreshToken);
    }
    return response.data.data;
  },

  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    if (response.data.data.tokens) {
      localStorage.setItem('accessToken', response.data.data.tokens.accessToken);
      localStorage.setItem('refreshToken', response.data.data.tokens.refreshToken);
    }
    return response.data;
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken });
      } catch (e) {
        console.error('Logout error', e);
      }
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },

  forgotPassword: async (email) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token, newPassword) => {
    const response = await api.post('/auth/reset-password', { token, newPassword });
    return response.data;
  },

  verifyEmail: async (token) => {
    const response = await api.get(`/auth/verify-email?token=${token}`);
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/users/me');
    return response.data.data;
  },

  updateProfile: async (data) => {
    const response = await api.put('/users/me', data);
    return response.data.data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await api.put('/users/me/password', { currentPassword, newPassword });
    return response.data;
  }
};

export default authService;
