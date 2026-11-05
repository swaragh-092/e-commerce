import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ForgotPasswordPage from '../../../pages/storefront/ForgotPasswordPage';
import ResetPasswordPage from '../../../pages/storefront/ResetPasswordPage';
import authService from '../../../services/authService';

vi.mock('../../../components/storefront/AuthPageShell', () => ({ default: ({ children }) => <section aria-label="Admin Portal">{children}</section> }));
vi.mock('../../../services/authService', () => ({ default: { forgotPassword: vi.fn(), resetPassword: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());
describe('Password recovery destinations', () => {
  it.each([true, false])('keeps the correct login destination (admin=%s)', async (admin) => {
    authService.forgotPassword.mockResolvedValue({ message: 'Check your email.' });
    render(<MemoryRouter><ForgotPasswordPage admin={admin} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Back to Login' })).toHaveAttribute('href', admin ? '/admin/login' : '/login');
    expect(Boolean(screen.queryByRole('region', { name: 'Admin Portal' }))).toBe(admin);
    fireEvent.change(screen.getByRole('textbox', { name: 'Email Address' }), { target: { value: 'staff@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));
    await screen.findByText('Check your email.');
    expect(authService.forgotPassword).toHaveBeenCalledWith('staff@example.com');
  });

  it('returns staff to admin login after a successful reset', async () => {
    authService.resetPassword.mockResolvedValue({});
    render(<MemoryRouter initialEntries={['/admin/reset-password?token=reset-token']}><ResetPasswordPage admin /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/^New Password/), { target: { value: 'NewPassword1!' } });
    fireEvent.change(screen.getByLabelText(/^Confirm New Password/), { target: { value: 'NewPassword1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Go to Login' })).toHaveAttribute('href', '/admin/login'));
    expect(authService.resetPassword).toHaveBeenCalledWith('reset-token', 'NewPassword1!');
  });
});
