import { useState } from 'react';
import { Box, Typography, TextField, Button, Alert } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import authService from '../../services/authService';
import { validateEmail } from '../../utils/authValidation';
import { getApiErrorMessage } from '../../utils/apiErrors';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleEmailChange = (e) => {
    const nextEmail = e.target.value;
    setEmail(nextEmail);
    setEmailError(validateEmail(nextEmail));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextEmailError = validateEmail(email);
    setEmailError(nextEmailError);
    setStatus({ type: '', message: '' });

    if (nextEmailError) {
      return;
    }

    setLoading(true);

    try {
      const res = await authService.forgotPassword(email);
      setStatus({ type: 'success', message: res.message });
      setEmail('');
    } catch (err) {
      setStatus({ type: 'error', message: getApiErrorMessage(err, 'Something went wrong. Please try again.') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 8 }}>
      <Typography variant="h4" component="h1" gutterBottom textAlign="center" fontWeight={600}>
        Reset Password
      </Typography>
      <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
        Enter your email address and we'll send you a link to reset your password.
      </Typography>
      
      {status.message && <Alert severity={status.type} sx={{ mb: 3 }}>{status.message}</Alert>}

      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          fullWidth
          margin="normal"
          label="Email Address"
          type="email"
          value={email}
          onChange={handleEmailChange}
          error={Boolean(emailError)}
          helperText={emailError}
          required
        />

        <Button
          fullWidth
          type="submit"
          variant="contained"
          size="large"
          sx={{ mt: 3, mb: 2 }}
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </Button>
        
        <Box textAlign="center" mt={2}>
            <Button component={RouterLink} to="/login" variant="text">
                Back to Login
            </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default ForgotPasswordPage;
