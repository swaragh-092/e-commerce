import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminProfilePage from '../../../pages/admin/AdminProfilePage';
const { updateProfile, changePassword, user } = vi.hoisted(() => ({ updateProfile: vi.fn(), changePassword: vi.fn(), user: { id: 'staff', firstName: 'Staff', lastName: 'Member', email: 'staff@example.test', status: 'active', emailVerified: true, profile: { phone: '9876543210' } } }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user, roles: ['super_admin'], permissions: ['products.read', 'products.update', 'orders.read'], updateProfile }) }));
vi.mock('../../../services/userService', () => ({ userService: { changePassword } }));
beforeEach(() => { vi.clearAllMocks(); updateProfile.mockResolvedValue({ ...user, firstName: 'Updated' }); changePassword.mockResolvedValue({}); });
describe('Admin profile', () => {
  it('saves only changed profile fields and shows inline feedback', async () => {
    render(<AdminProfilePage />);
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: 'Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await screen.findByText('Profile saved.');
    expect(updateProfile).toHaveBeenCalledWith({ firstName: 'Updated' });
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled();
  });
  it('validates confirmation then submits current and new passwords and clears them', async () => {
    render(<AdminProfilePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    fireEvent.change(screen.getByLabelText(/^Current password/), { target: { value: 'OldPassword1!' } });
    fireEvent.change(screen.getByLabelText(/^New password/), { target: { value: 'NewPassword1!' } });
    fireEvent.change(screen.getByLabelText(/^Confirm new password/), { target: { value: 'Mismatch1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(screen.getByText('New passwords do not match.')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/^Confirm new password/), { target: { value: 'NewPassword1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    await screen.findByText(/Password changed. Your other sessions/);
    expect(changePassword).toHaveBeenCalledWith({ currentPassword: 'OldPassword1!', newPassword: 'NewPassword1!', confirmPassword: 'NewPassword1!' });
    expect(screen.getByLabelText(/^Current password/)).toHaveValue('');
    expect(screen.getByLabelText(/^New password/)).toHaveValue('');
  });
  it('preserves input after a failed update and allows retry', async () => {
    updateProfile.mockRejectedValueOnce(new Error('Offline'));
    render(<AdminProfilePage />);
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: 'Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save profile' })).toBeEnabled());
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText(/First name/)).toHaveValue('Updated');
  });
  it('keeps permissions collapsed and groups them by resource when expanded', () => {
    render(<AdminProfilePage />);
    const toggle = screen.getByRole('button', { name: 'View permissions (3)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Products')).toBeVisible();
    expect(screen.getByText('Orders')).toBeVisible();
  });
});
