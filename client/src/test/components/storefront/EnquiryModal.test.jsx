import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EnquiryModal from '../../../components/storefront/EnquiryModal';
import { AuthContext } from '../../../context/AuthContext';
import { SettingsContext } from '../../../context/ThemeContext';
import LoginPage from '../../../pages/storefront/LoginPage';
import OAuthCallbackPage from '../../../pages/storefront/OAuthCallbackPage';
import api from '../../../services/api';
import { saveOAuthReturnPath } from '../../../utils/loginReturnPath';

vi.mock('../../../services/authService', () => ({ default: { completeGoogleOAuth: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('../../../services/api', () => ({ default: { post: vi.fn() } }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify: vi.fn() }) }));

const product = { id: 'product-1', name: 'Marigold', selectedVariant: { id: 'variant-1' } };
const productPath = '/products/marigold?variant=variant-1#details';
const login = vi.fn();
const verifyTwoFactor = vi.fn();
const finalizeAuthenticatedSession = vi.fn();

const ProductEnquiry = () => {
  const { pathname, search, hash } = useLocation();
  return (
    <>
      <output>{pathname}{search}{hash}</output>
      <EnquiryModal open product={product} onClose={() => {}} />
    </>
  );
};

const view = ({ required, signedIn = false, initialPath = productPath }) => render(
  <MemoryRouter initialEntries={[initialPath]}>
    <AuthContext.Provider value={{ isAuthenticated: signedIn, login, verifyTwoFactor, finalizeAuthenticatedSession }}>
      <SettingsContext.Provider value={{ settings: {}, features: { requireLoginForEnquiry: required } }}>
        <Routes>
          <Route path="/products/marigold" element={<ProductEnquiry />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        </Routes>
      </SettingsContext.Provider>
    </AuthContext.Provider>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('Enquiry sign-in prompt', () => {
  it('replaces the guest form with a login action and returns to the selected variant', async () => {
    login.mockResolvedValue({ user: { email: 'account@example.com' } });
    view({ required: true });
    expect(screen.getByText('Log in to submit an enquiry.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Log in' }));
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'account@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    expect(await screen.findByText(productPath)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('restores the selected variant after the Google sign-in redirect', async () => {
    finalizeAuthenticatedSession.mockResolvedValue({});
    saveOAuthReturnPath(productPath);
    view({ required: true, signedIn: true, initialPath: '/oauth/callback' });
    expect(await screen.findByText(productPath)).toBeInTheDocument();
  });

  it('restores the selected variant after Google sign-in with two-factor authentication', async () => {
    verifyTwoFactor.mockResolvedValue({ user: { email: 'account@example.com' } });
    saveOAuthReturnPath(productPath);
    view({ required: true, initialPath: '/login#requiresTwoFactor=true&tempToken=test-token' });
    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText(productPath)).toBeInTheDocument();
    expect(verifyTwoFactor).toHaveBeenCalledWith('test-token', '123456', false);
  });

  it.each([[true, true], [false, false]])('allows an editable reply email with required=%s and signedIn=%s', async (required, signedIn) => {
    api.post.mockResolvedValue({});
    view({ required, signedIn });
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test Customer' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'purchasing@example.com' } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Please send details.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/enquiries', expect.objectContaining({
      email: 'purchasing@example.com', productId: product.id, variantId: product.selectedVariant.id,
    })));
    expect(await screen.findByText(/submitted successfully/i)).toBeInTheDocument();
  });
});
