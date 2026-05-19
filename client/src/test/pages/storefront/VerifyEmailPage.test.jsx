import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VerifyEmailPage from '../../../pages/storefront/VerifyEmailPage';
import authService from '../../../services/authService';

vi.mock('../../../services/authService', () => ({
  default: {
    verifyEmail: vi.fn(),
  },
}));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</div>;
};

const renderPage = (initialEntry) =>
  render(
    <MemoryRouter
      initialEntries={[initialEntry]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route
          path="/verify-email"
          element={
            <>
              <LocationProbe />
              <VerifyEmailPage />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads a fragment token, scrubs it from the URL, and verifies once', async () => {
    authService.verifyEmail.mockResolvedValue({ success: true });

    renderPage('/verify-email#token=secret-token');

    await screen.findByText(/successfully verified/i);
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/verify-email');
    });

    expect(authService.verifyEmail).toHaveBeenCalledTimes(1);
    expect(authService.verifyEmail).toHaveBeenCalledWith('secret-token');
  });

  it('shows an error when no token is present', async () => {
    renderPage('/verify-email');

    expect(await screen.findByText(/invalid or missing verification token/i)).toBeInTheDocument();
    expect(authService.verifyEmail).not.toHaveBeenCalled();
  });
});
