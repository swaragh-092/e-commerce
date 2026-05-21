import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';

const OAuthCallbackPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { finalizeAuthenticatedSession } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (accessToken && refreshToken) {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      finalizeAuthenticatedSession()
        .then(() => navigate('/', { replace: true }))
        .catch(() => {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          navigate('/login?error=oauth_failed', { replace: true });
        });
    } else {
      navigate('/login?error=oauth_failed', { replace: true });
    }
  }, []);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <CircularProgress />
    </Box>
  );
};

export default OAuthCallbackPage;
