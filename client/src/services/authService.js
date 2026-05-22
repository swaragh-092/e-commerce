import api from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const authService = {
  login: async (email, password, rememberMe = false) => {
    const response = await api.post('/auth/login', { email, password, rememberMe });
    const data = response.data.data;
    // If 2FA is required, don't store tokens yet
    if (data.requiresTwoFactor) {
      return data;
    }
    if (data.tokens) {
      localStorage.setItem('accessToken', data.tokens.accessToken);
      localStorage.setItem('refreshToken', data.tokens.refreshToken);
    }
    // Persist email for "remember me"
    if (rememberMe) {
      localStorage.setItem('rememberedEmail', email);
    } else {
      localStorage.removeItem('rememberedEmail');
    }
    return data;
  },

  verifyTwoFactor: async (tempToken, code, trustDevice = false) => {
    const response = await api.post('/auth/2fa/verify', { tempToken, code, trustDevice });
    const data = response.data.data;
    if (data.tokens) {
      localStorage.setItem('accessToken', data.tokens.accessToken);
      localStorage.setItem('refreshToken', data.tokens.refreshToken);
    }
    return data;
  },

  setup2FA: async () => {
    const response = await api.post('/auth/2fa/setup');
    return response.data.data;
  },

  enable2FA: async (code) => {
    const response = await api.post('/auth/2fa/enable', { code });
    return response.data.data;
  },

  disable2FA: async (code) => {
    const response = await api.post('/auth/2fa/disable', { code });
    return response.data.data;
  },

  regenerateBackupCodes: async (code) => {
    const response = await api.post('/auth/2fa/backup-codes', { code });
    return response.data.data;
  },

  getGoogleOAuthUrl: () => `${API_URL}/auth/google`,

  sendOtp: async (phone) => {
    const response = await api.post('/auth/otp/send', { phone });
    return response.data.data;
  },

  verifyOtp: async (phone, code) => {
    const response = await api.post('/auth/otp/verify', { phone, code });
    const data = response.data.data;
    if (data.tokens) {
      localStorage.setItem('accessToken', data.tokens.accessToken);
      localStorage.setItem('refreshToken', data.tokens.refreshToken);
    }
    return data;
  },

  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    // Store tokens so the user is logged in immediately after registering
    if (response.data.data.tokens) {
      localStorage.setItem('accessToken', response.data.data.tokens.accessToken);
      localStorage.setItem('refreshToken', response.data.data.tokens.refreshToken);
    }
    return response.data.data; // { user, tokens }
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
    const response = await api.post('/auth/verify-email', { token });
    return response.data;
  },

  resendVerification: async (email) => {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await api.put('/users/me/password', { currentPassword, newPassword });
    return response.data;
  },
};

export default authService;
