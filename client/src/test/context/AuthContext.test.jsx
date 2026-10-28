import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useContext } from 'react';
import { AuthContext, AuthProvider } from '../../context/AuthContext';
import { PERMISSIONS } from '../../utils/permissions';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  getMe: vi.fn(),
  mergeGuestCart: vi.fn(),
  mergeGuestWishlist: vi.fn(),
}));

vi.mock('../../services/authService', () => ({ default: { login: mocks.login } }));
vi.mock('../../services/userService', () => ({ userService: { getMe: mocks.getMe } }));
vi.mock('../../services/cartService', () => ({ default: { mergeGuestCart: mocks.mergeGuestCart } }));
vi.mock('../../services/wishlistService', () => ({ wishlistService: { mergeGuestWishlist: mocks.mergeGuestWishlist } }));

const SessionProbe = () => {
  const { login } = useContext(AuthContext);
  return <button onClick={() => login('customer@example.com', 'password')}>Sign in</button>;
};

const PermissionProbe = () => {
  const { hasPermission } = useContext(AuthContext);
  return <span data-testid="has-products">{String(hasPermission(PERMISSIONS.PRODUCTS_READ))}</span>;
};

describe('AuthContext guest order session', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.login.mockReset().mockResolvedValue({ success: true });
    mocks.getMe.mockReset().mockResolvedValue({ id: 'customer-1', email: 'customer@example.com' });
    mocks.mergeGuestCart.mockReset().mockResolvedValue(undefined);
    mocks.mergeGuestWishlist.mockReset().mockResolvedValue(undefined);
  });

  it('keeps the guest checkout session after sign-in so guest orders remain accessible', async () => {
    const guestSessionId = '123e4567-e89b-42d3-a456-426614174000';
    localStorage.setItem('cartSessionId', guestSessionId);
    render(<AuthProvider><SessionProbe /></AuthProvider>);
    await waitFor(() => expect(mocks.getMe).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(mocks.getMe).toHaveBeenCalledTimes(2));
    expect(mocks.mergeGuestCart).toHaveBeenCalledOnce();
    expect(mocks.mergeGuestWishlist).toHaveBeenCalledOnce();
    expect(localStorage.getItem('cartSessionId')).toBe(guestSessionId);
  });
});

describe('AuthContext active-session revocation', () => {
  const revokedHandler = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    mocks.getMe.mockReset();
    mocks.mergeGuestCart.mockReset().mockResolvedValue(undefined);
    mocks.mergeGuestWishlist.mockReset().mockResolvedValue(undefined);
    revokedHandler.mockClear();
    window.addEventListener('auth:permissions-revoked', revokedHandler);
  });

  afterEach(() => {
    window.removeEventListener('auth:permissions-revoked', revokedHandler);
  });

  it('refreshes on focus and fires a revocation event when a permission is removed', async () => {
    mocks.getMe
      .mockResolvedValueOnce({
        id: 'admin-1',
        role: 'admin',
        permissions: [PERMISSIONS.PRODUCTS_READ, PERMISSIONS.ORDERS_READ],
      })
      .mockResolvedValueOnce({
        id: 'admin-1',
        role: 'admin',
        permissions: [PERMISSIONS.ORDERS_READ],
      });

    render(<AuthProvider><PermissionProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('has-products')).toHaveTextContent('true'));

    // Simulate returning to the tab: the session is re-validated against /users/me.
    fireEvent(window, new Event('focus'));

    await waitFor(() => expect(revokedHandler).toHaveBeenCalled());
    expect(revokedHandler.mock.calls[0][0].detail.lostPermissions).toContain(PERMISSIONS.PRODUCTS_READ);
    await waitFor(() => expect(screen.getByTestId('has-products')).toHaveTextContent('false'));
  });
});
