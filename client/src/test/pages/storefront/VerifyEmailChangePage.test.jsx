import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import VerifyEmailChangePage from '../../../pages/storefront/VerifyEmailChangePage';

const { confirmEmailChange, refreshUser } = vi.hoisted(() => ({ confirmEmailChange: vi.fn(), refreshUser: vi.fn() }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true, refreshUser }) }));
vi.mock('../../../services/userService', () => ({ userService: { confirmEmailChange } }));

const Location = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
};

const renderPage = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/verify-email-change" element={<><VerifyEmailChangePage /><Location /></>} />
    </Routes>
  </MemoryRouter>,
);

describe('VerifyEmailChangePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmEmailChange.mockResolvedValue({ email: 'new@example.test' });
    refreshUser.mockResolvedValue({});
  });

  it('confirms the token, refreshes the active session, and removes the token from the URL', async () => {
    renderPage('/verify-email-change?token=secret-token');
    await screen.findByText('Your sign-in email has been changed to new@example.test.');
    expect(confirmEmailChange).toHaveBeenCalledWith('secret-token');
    expect(refreshUser).toHaveBeenCalledOnce();
    expect(screen.getByTestId('location')).toHaveTextContent('/verify-email-change');
    expect(screen.getByTestId('location')).not.toHaveTextContent('secret-token');
  });

  it('shows an expired-link error and does not refresh the session', async () => {
    confirmEmailChange.mockRejectedValue(new Error('Invalid or expired token'));
    renderPage('/verify-email-change?token=expired');
    await screen.findByText('Invalid or expired token');
    expect(refreshUser).not.toHaveBeenCalled();
  });
});
