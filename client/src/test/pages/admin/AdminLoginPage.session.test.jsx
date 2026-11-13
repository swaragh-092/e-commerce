import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AdminLoginPage from '../../../pages/admin/AdminLoginPage';
const login = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ login, isAuthenticated: false, user: null }) }));
vi.mock('../../../components/storefront/AuthPageShell', () => ({ default: ({ children }) => <div>{children}</div> }));
it('offers remembered-device recognition without promising persistent admin access', async () => {
  login.mockResolvedValue({ requiresTwoFactor: true, tempToken: 'signed-mfa-context' });
  render(<MemoryRouter><AdminLoginPage /></MemoryRouter>);
  expect(screen.getByText(/does not keep admin access open/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'admin@example.test' } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'test-password' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Remember this device for 30 days' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
  await waitFor(() => expect(login).toHaveBeenCalledWith('admin@example.test', 'test-password', true));
});
