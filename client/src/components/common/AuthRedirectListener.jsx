import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Listens for the global `auth:unauthorized` event (fired by the Axios
 * interceptor when refresh fails) and redirects to /login, preserving
 * the page the user was on so they land back there after re-authenticating.
 *
 * Must be rendered inside <BrowserRouter>.
 */
const AuthRedirectListener = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleUnauthorized = () => {
      // Don't redirect if already on login/register/auth pages
      const authPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/admin/login'];
      if (authPaths.some((p) => location.pathname.startsWith(p))) return;

      navigate('/login', {
        state: { from: location, message: 'Your session has expired. Please log in again.', sessionExpired: true },
        replace: true,
      });
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [navigate, location]);

  return null;
};

export default AuthRedirectListener;
