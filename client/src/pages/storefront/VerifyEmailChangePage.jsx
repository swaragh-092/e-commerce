import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { getApiErrorMessage } from '../../utils/apiErrors';

const VerifyEmailChangePage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, refreshUser } = useAuth();
  const [token] = useState(() => {
    const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
    return hashParams.get('token') || searchParams.get('token');
  });
  const [status, setStatus] = useState({ loading: true, severity: 'info', message: '' });
  const hasConfirmed = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus({ loading: false, severity: 'error', message: 'This email confirmation link is missing its token.' });
      return;
    }
    if (location.hash || searchParams.has('token')) {
      navigate(location.pathname, { replace: true });
    }
    if (hasConfirmed.current) return;
    hasConfirmed.current = true;

    const confirm = async () => {
      try {
        const result = await userService.confirmEmailChange(token);
        if (isAuthenticated) {
          try { await refreshUser(); } catch { /* Confirmation succeeded; refresh is only for the current browser session. */ }
        }
        setStatus({ loading: false, severity: 'success', message: `Your sign-in email has been changed to ${result.email}.` });
      } catch (error) {
        setStatus({ loading: false, severity: 'error', message: getApiErrorMessage(error, 'This confirmation link is invalid or has expired.') });
      }
    };
    confirm();
  }, [isAuthenticated, location.hash, location.pathname, navigate, refreshUser, searchParams, token]);

  return (
    <Box sx={{ maxWidth: 520, mx: 'auto', mt: 10, px: 2, textAlign: 'center' }}>
      <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>Confirm email change</Typography>
      {status.loading ? (
        <Stack spacing={2} alignItems="center" sx={{ mt: 4 }}>
          <CircularProgress size={40} />
          <Typography color="text.secondary">Confirming your new email address…</Typography>
        </Stack>
      ) : (
        <Box sx={{ mt: 4 }}>
          <Alert severity={status.severity} sx={{ mb: 3, textAlign: 'left' }} role="status">{status.message}</Alert>
          <Button component={RouterLink} to={isAuthenticated ? '/admin/profile' : '/admin/login'} variant="contained">
            {isAuthenticated ? 'Return to profile' : 'Continue to sign in'}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default VerifyEmailChangePage;
