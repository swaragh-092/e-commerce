import { beforeEach, describe, expect, it, vi } from 'vitest';
import authService from '../../services/authService';
import api from '../../services/api';
import { beginAuthSessionChange, completeAuthSessionChange } from '../../services/api';

vi.mock('../../services/api', () => ({
  changeAuthSession: vi.fn(operation => operation()),
  beginAuthSessionChange: vi.fn().mockResolvedValue(undefined),
  completeAuthSessionChange: vi.fn().mockResolvedValue(undefined),
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe('authService', () => {
  it('uses the dedicated verified policy endpoint for security settings', async () => {
    const policy = { requireAdministrators: false, staffMode: 'optional', requiredRoleIds: [] };
    api.get.mockResolvedValue({ data: { data: { policy } } });
    api.put.mockResolvedValue({ data: { data: { policy } } });
    expect(await authService.getMfaPolicy()).toEqual({ policy });
    const payload = { policy, verification: { currentPassword: 'provided-by-user' } };
    await authService.updateMfaPolicy(payload);
    expect(api.put).toHaveBeenCalledWith('/auth/mfa-policy', payload);
  });
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('sends verification tokens in the POST body', async () => {
    api.post.mockResolvedValue({ data: { success: true } });

    await authService.verifyEmail('verify-token');

    expect(api.post).toHaveBeenCalledWith('/auth/verify-email', { token: 'verify-token' });
  });

  it('updates the session generation before starting Google OAuth navigation', async () => {
    const navigate = vi.fn(() => {
      expect(beginAuthSessionChange).toHaveBeenCalledTimes(1);
    });

    await authService.startGoogleOAuth(navigate);

    expect(navigate).toHaveBeenCalledWith(authService.getGoogleOAuthUrl());
    expect(sessionStorage.getItem('auth:google-oauth-attempt')).toBe('pending');
  });

  it('completes OAuth only for the initiating tab and clears its attempt marker', async () => {
    await expect(authService.completeGoogleOAuth()).rejects.toMatchObject({ code: 'SESSION_STATE_UNCERTAIN' });
    sessionStorage.setItem('auth:google-oauth-attempt', 'pending');
    await authService.completeGoogleOAuth();

    expect(completeAuthSessionChange).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('auth:google-oauth-attempt')).toBeNull();
  });
});
