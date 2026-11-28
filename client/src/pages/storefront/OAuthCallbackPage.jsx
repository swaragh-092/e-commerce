import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import authService from '../../services/authService';
import { takeOAuthReturnPath } from '../../utils/loginReturnPath';

const OAuthCallbackPage = () => {
  const navigate = useNavigate();
  const { finalizeAuthenticatedSession } = useAuth();

  const callbackRequest = useRef(null);
  useEffect(() => {
    let active = true;
    callbackRequest.current ??= authService.completeGoogleOAuth().then(() => finalizeAuthenticatedSession());
    callbackRequest.current
      .then(() => {
        if (active) navigate(takeOAuthReturnPath() || '/', { replace: true });
      })
      .catch(() => {
        if (active) navigate('/login?error=oauth_failed', { replace: true });
      });
    return () => { active = false; };
  }, [finalizeAuthenticatedSession, navigate]);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <CircularProgress />
    </Box>
  );
};

export default OAuthCallbackPage;
