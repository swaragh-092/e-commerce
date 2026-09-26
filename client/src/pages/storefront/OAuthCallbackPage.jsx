import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';

const OAuthCallbackPage = () => {
  const navigate = useNavigate();
  const { finalizeAuthenticatedSession } = useAuth();

  useEffect(() => {
    finalizeAuthenticatedSession()
      .then(() => navigate('/', { replace: true }))
      .catch(() => {
        navigate('/login?error=oauth_failed', { replace: true });
      });
  }, [finalizeAuthenticatedSession, navigate]);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <CircularProgress />
    </Box>
  );
};

export default OAuthCallbackPage;
