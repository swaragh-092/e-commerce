import { beforeEach, describe, expect, it, vi } from 'vitest';
import authService from '../../services/authService';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends verification tokens in the POST body', async () => {
    api.post.mockResolvedValue({ data: { success: true } });

    await authService.verifyEmail('verify-token');

    expect(api.post).toHaveBeenCalledWith('/auth/verify-email', { token: 'verify-token' });
  });
});
