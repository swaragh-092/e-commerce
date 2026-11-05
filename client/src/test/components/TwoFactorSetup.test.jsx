import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TwoFactorSetup from '../../components/storefront/TwoFactorSetup';
import authService from '../../services/authService';
vi.mock('../../services/authService', () => ({ default: {
  setup2FA: vi.fn(), enable2FA: vi.fn(), disable2FA: vi.fn(), regenerateBackupCodes: vi.fn(),
} }));
beforeEach(() => vi.clearAllMocks());
describe('Authenticator enrollment and recovery codes', () => {
  it('keeps one-time backup codes visible until the user confirms saving them', async () => {
    authService.setup2FA.mockResolvedValue({ qrCodeDataUrl: 'data:image/png;base64,', secret: 'test-only-setup' });
    authService.enable2FA.mockResolvedValue({ enabled: true, backupCodes: ['aabb1122', 'ccdd3344'] });
    const update = vi.fn().mockResolvedValue({});
    render(<TwoFactorSetup user={{ twoFactorEnabled: false }} onUpdate={update} />);
    fireEvent.click(screen.getByRole('button', { name: 'Set Up 2FA' }));
    fireEvent.change(await screen.findByPlaceholderText('Enter 6-digit code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify & Enable' }));
    expect(await screen.findByText('aabb1122')).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: "I've saved my codes" }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('aabb1122')).not.toBeInTheDocument();
  });
});
