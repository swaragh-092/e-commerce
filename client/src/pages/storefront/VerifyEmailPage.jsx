import { useEffect, useState, useRef } from 'react';
import { Box, Typography, Button, Alert, CircularProgress } from '@mui/material';
import { useSearchParams, Link as RouterLink } from 'react-router-dom';
import authService from '../../../services/authService';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState({ loading: true, type: '', message: '' });
  const hasVerified = useRef(false); // strict mode double-fire prevention

  useEffect(() => {
    if (!token) {
        setStatus({ loading: false, type: 'error', message: 'Invalid or missing verification token.' });
        return;
    }

    if (hasVerified.current) return;
    hasVerified.current = true;

    const verify = async () => {
        try {
            await authService.verifyEmail(token);
            setStatus({ loading: false, type: 'success', message: 'Your email has been successfully verified! You can now log in.' });
        } catch (err) {
            setStatus({ loading: false, type: 'error', message: err.response?.data?.message || 'Verification failed. The link may have expired or is invalid.' });
        }
    };

    verify();
  }, [token]);

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 10, textAlign: 'center' }}>
      <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
        Email Verification
      </Typography>
      
      {status.loading ? (
          <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography color="text.secondary">Verifying your email address...</Typography>
          </Box>
      ) : (
          <Box sx={{ mt: 4 }}>
              <Alert severity={status.type} sx={{ mb: 4, justifyContent: 'center' }}>
                  {status.message}
              </Alert>

              <Button component={RouterLink} to="/login" variant="contained" size="large">
                  Go to Login
              </Button>
          </Box>
      )}
    </Box>
  );
};

export default VerifyEmailPage;
