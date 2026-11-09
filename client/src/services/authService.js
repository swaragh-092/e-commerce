import api, {
  beginAuthSessionChange,
  changeAuthSession,
  completeAuthSessionChange,
} from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const OAUTH_ATTEMPT_KEY = 'auth:google-oauth-attempt';

// Recover expired authentication after releasing the session-change lock.
const changeMfa = async (path, code) => {
  const change = () => changeAuthSession(
    () => api.post(path, { code }, { skipAuthRefresh: true }),
    { restoreOnRejectedLoginResponse: true },
  );
  try { return await change(); } catch (error) {
    if (error.response?.status !== 401) throw error;
    await api.get('/users/me');
    return change();
  }
};

const authService = {
  getMfaPolicy: async () => (await api.get('/auth/mfa-policy')).data.data,
  updateMfaPolicy: async (payload) => (await api.put('/auth/mfa-policy', payload)).data.data,
  login: async (email, password, rememberMe = false) => {
    // The login controller writes auth cookies only on a successful response;
    // its definitive 4xx rejections therefore leave the existing session intact.
    const response = await changeAuthSession(() => api.post('/auth/login', { email, password, rememberMe }), {
      restoreOnRejectedLoginResponse: true,
    });
    const data = response.data.data;
    // If 2FA is required, don't store tokens yet
    if (data.requiresTwoFactor) return data;
    // Persist email for "remember me"
    if (rememberMe) {
      localStorage.setItem('rememberedEmail', email);
    } else {
      localStorage.removeItem('rememberedEmail');
    }
    return data;
  },

  verifyTwoFactor: async (tempToken, code, trustDevice = false) => {
    const response = await changeAuthSession(() => api.post('/auth/2fa/verify', { tempToken, code, trustDevice }));
    return response.data.data;
  },

  sendEmailMfaCode: async emailChallenge => api.post('/auth/2fa/email/send', { emailChallenge }, { skipAuthRefresh: true }),

  verifyEmailMfaCode: async (emailChallenge, code) => {
    const response = await changeAuthSession(
      () => api.post('/auth/2fa/email/verify', { emailChallenge, code }, { skipAuthRefresh: true }),
      { restoreOnRejectedLoginResponse: true },
    );
    return response.data.data;
  },

  setup2FA: async () => {
    const response = await api.post('/auth/2fa/setup');
    return response.data.data;
  },

  enable2FA: async (code) => {
    const response = await changeMfa('/auth/2fa/enable', code);
    return response.data.data;
  },

  disable2FA: async (code) => {
    const response = await changeMfa('/auth/2fa/disable', code);
    return response.data.data;
  },

  regenerateBackupCodes: async (code) => {
    const response = await api.post('/auth/2fa/backup-codes', { code });
    return response.data.data;
  },

  getGoogleOAuthUrl: () => `${API_URL}/auth/google`,

  startGoogleOAuth: async (navigate = url => window.location.assign(url)) => {
    // Keep the marker pending across the redirect; other tabs must not refresh
    // or replay requests until the callback has changed the auth cookies.
    window.sessionStorage.setItem(OAUTH_ATTEMPT_KEY, 'pending');
    try {
      await beginAuthSessionChange();
    } catch (error) {
      window.sessionStorage.removeItem(OAUTH_ATTEMPT_KEY);
      throw error;
    }
    navigate(authService.getGoogleOAuthUrl());
  },

  completeGoogleOAuth: async () => {
    if (window.sessionStorage.getItem(OAUTH_ATTEMPT_KEY) !== 'pending') {
      throw Object.assign(new Error('OAuth callback did not match this browser tab.'), { code: 'SESSION_STATE_UNCERTAIN' });
    }
    await completeAuthSessionChange();
    window.sessionStorage.removeItem(OAUTH_ATTEMPT_KEY);
  },

  sendOtp: async (phone) => {
    const response = await api.post('/auth/otp/send', { phone });
    return response.data.data;
  },

  verifyOtp: async (phone, code) => {
    const response = await changeAuthSession(() => api.post('/auth/otp/verify', { phone, code }));
    return response.data.data;
  },

  register: async (userData) => {
    const response = await changeAuthSession(() => api.post('/auth/register', userData));
    return response.data.data; // { user, verificationEmail }
  },

  logout: async () => {
    try {
      await changeAuthSession(() => api.post('/auth/logout'));
    } catch (e) {
      console.error('Logout error', e);
    }
  },

  forgotPassword: async (email) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token, newPassword) => {
    const response = await changeAuthSession(() => api.post('/auth/reset-password', { token, newPassword }));
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

  changePassword: async (currentPassword, newPassword, confirmPassword) => {
    const response = await api.put('/users/me/password', {
      currentPassword,
      newPassword,
      confirmPassword: confirmPassword ?? newPassword,
    });
    return response.data;
  },
};

export default authService;
