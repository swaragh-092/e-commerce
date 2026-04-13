import { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Alert } from '@mui/material';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import authService from '../../services/authService';
import { validatePassword } from '../../utils/authValidation';
import { getApiErrorMessage } from '../../utils/apiErrors';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ newPassword: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
        setStatus({ type: 'error', message: 'Invalid or missing password reset token.' });
    }
  }, [token]);

  const validateForm = (values) => ({
    newPassword: validatePassword(values.newPassword),
    confirmPassword: values.confirmPassword
      ? (values.newPassword === values.confirmPassword ? '' : 'Passwords do not match')
      : 'Confirm password is required',
  });

  const handleChange = (e) => {
    const nextFormData = { ...formData, [e.target.name]: e.target.value };
    setFormData(nextFormData);
    setFieldErrors(validateForm(nextFormData));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;

    const nextErrors = validateForm(formData);
    setFieldErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
        return setStatus({ type: 'error', message: 'Please fix the highlighted fields.' });
    }

    setStatus({ type: '', message: '' });
    setLoading(true);

    try {
      await authService.resetPassword(token, formData.newPassword);
      setStatus({ type: 'success', message: 'Password has been reset successfully.' });
      setTimeout(() => navigate('/login'), 3000); // Redirect to login after 3 seconds
    } catch (err) {
      setStatus({ type: 'error', message: getApiErrorMessage(err, 'Failed to reset password. The token may be expired.') });
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
      return (
          <Box sx={{ maxWidth: 400, mx: 'auto', mt: 8 }}>
              <Alert severity="error">Invalid link. Please request a new password reset.</Alert>
          </Box>
      );
  }

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 8 }}>
      <Typography variant="h4" component="h1" gutterBottom textAlign="center" fontWeight={600}>
        Create New Password
      </Typography>
      
      {status.message && <Alert severity={status.type} sx={{ mb: 3 }}>{status.message}</Alert>}

      {status.type !== 'success' && (
        <Box component="form" onSubmit={handleSubmit}>
            <TextField
            fullWidth
            margin="normal"
            label="New Password"
            name="newPassword"
            type="password"
            value={formData.newPassword}
            onChange={handleChange}
            error={Boolean(fieldErrors.newPassword)}
            helperText={fieldErrors.newPassword || 'Minimum 8 characters, at least 1 uppercase and 1 number'}
            required
            />
            <TextField
            fullWidth
            margin="normal"
            label="Confirm New Password"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            error={Boolean(fieldErrors.confirmPassword)}
            helperText={fieldErrors.confirmPassword}
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
            {loading ? 'Resetting...' : 'Reset Password'}
            </Button>
        </Box>
      )}
      
      {status.type === 'success' && (
          <Button fullWidth component={RouterLink} to="/login" variant="contained">
              Go to Login
          </Button>
      )}
    </Box>
  );
};

export default ResetPasswordPage;
