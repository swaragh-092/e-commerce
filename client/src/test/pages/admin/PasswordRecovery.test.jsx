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
  it('keeps password validation errors focused on correcting the form', () => {
    render(<MemoryRouter initialEntries={['/reset-password?token=valid-token']}><ResetPasswordPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/^New Password/), { target: { value: 'NewPassword1!' } });
    fireEvent.change(screen.getByLabelText(/^Confirm New Password/), { target: { value: 'DifferentPassword1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Request a new reset link' })).not.toBeInTheDocument();
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it.each([true, false])('offers a way out of a missing reset link (admin=%s)', (admin) => {
    render(<MemoryRouter><ResetPasswordPage admin={admin} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Request a new reset link' })).toHaveAttribute('href', admin ? '/admin/forgot-password' : '/forgot-password');
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it.each([true, false])('offers a new link after a rejected reset token (admin=%s)', async (admin) => {
    authService.resetPassword.mockRejectedValue({ response: { data: { error: { message: 'Reset token expired.' } } } });
    render(<MemoryRouter initialEntries={['/reset-password?token=expired']}><ResetPasswordPage admin={admin} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/^New Password/), { target: { value: 'NewPassword1!' } });
    fireEvent.change(screen.getByLabelText(/^Confirm New Password/), { target: { value: 'NewPassword1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));
    await screen.findByText('Reset token expired.');
    expect(screen.getByRole('link', { name: 'Request a new reset link' })).toHaveAttribute('href', admin ? '/admin/forgot-password' : '/forgot-password');
  });

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
