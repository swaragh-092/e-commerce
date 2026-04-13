import { useState } from 'react';
import { Box, Typography, TextField, Button, Alert, useTheme } from '@mui/material';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getFirstAccessibleAdminPath } from '../../utils/permissions';
import { validateEmail, validateRequired } from '../../utils/authValidation';
import { getApiErrorMessage } from '../../utils/apiErrors';

const LoginPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState(location.state?.message || '');
  const [loading, setLoading] = useState(false);

  const validateForm = (values) => ({
    email: validateEmail(values.email),
    password: validateRequired(values.password, 'Password'),
  });

  const handleChange = (e) => {
    const nextFormData = { ...formData, [e.target.name]: e.target.value };
    setFormData(nextFormData);
    setFieldErrors(validateForm(nextFormData));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validateForm(formData);
    setFieldErrors(nextErrors);
    setError('');
    setSuccessMsg('');

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setLoading(true);

    try {
      const data = await login(formData.email, formData.password);
      const adminEntryPath = getFirstAccessibleAdminPath(data.user);
      if (adminEntryPath) {
        navigate(adminEntryPath);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Login failed. Please verify credentials.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 8 }}>
      <Typography variant="h4" component="h1" gutterBottom textAlign="center" fontWeight={600}>
        Welcome Back
      </Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}

      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          fullWidth
          margin="normal"
          label="Email Address"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          error={Boolean(fieldErrors.email)}
          helperText={fieldErrors.email}
          required
        />
        <TextField
          fullWidth
          margin="normal"
          label="Password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          error={Boolean(fieldErrors.password)}
          helperText={fieldErrors.password}
          required
        />
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Typography variant="body2" component={RouterLink} to="/forgot-password" sx={{ textDecoration: 'none', color: theme.palette.primary.main }}>
            Forgot password?
          </Typography>
        </Box>

        <Button
          fullWidth
          type="submit"
          variant="contained"
          size="large"
          sx={{ mt: 3, mb: 2 }}
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Log In'}
        </Button>
        
        <Typography textAlign="center" variant="body2">
          Don't have an account?{' '}
          <Box component={RouterLink} to="/register" sx={{ color: theme.palette.primary.main, textDecoration: 'none', fontWeight: 600 }}>
            Sign up
          </Box>
        </Typography>
      </Box>
    </Box>
  );
};

export default LoginPage;
