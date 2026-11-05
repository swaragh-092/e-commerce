import { beforeEach, describe, expect, it, vi } from 'vitest';
import authService from '../../services/authService';
import api from '../../services/api';
import { changeAuthSession, beginAuthSessionChange, completeAuthSessionChange } from '../../services/api';

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
  it.each(['enable2FA', 'disable2FA'])('recovers expired authentication outside the session change for %s', async method => {
    const unauthorized = { response: { status: 401 } };
    api.post.mockRejectedValueOnce(unauthorized).mockResolvedValueOnce({ data: { data: { enabled: true } } });
    api.get.mockImplementationOnce(async () => {
      expect(changeAuthSession).toHaveBeenCalledTimes(1);
      return {};
    });
    await authService[method]('123456');
    expect(api.get).toHaveBeenCalledWith('/users/me');
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(api.post.mock.calls[0][2]).toEqual({ skipAuthRefresh: true });
    expect(changeAuthSession.mock.calls[0][1]).toEqual({ restoreOnRejectedLoginResponse: true });
  });

  it.each([400, 403])('does not retry definitive MFA rejection %s', async status => {
    api.post.mockRejectedValueOnce({ response: { status } });
    await expect(authService.disable2FA('123456')).rejects.toMatchObject({ response: { status } });
    expect(api.get).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(changeAuthSession.mock.calls[0][1]).toEqual({ restoreOnRejectedLoginResponse: true });
  });

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
