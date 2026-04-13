import { useState } from 'react';
import { Box, Typography, TextField, Button, Alert, useTheme } from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { validateEmail, validatePassword, validateRequired } from '../../utils/authValidation';
import { getApiErrorMessage } from '../../utils/apiErrors';

const RegisterPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { register } = useAuth();
  
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = (values) => ({
    firstName: validateRequired(values.firstName, 'First name'),
    lastName: validateRequired(values.lastName, 'Last name'),
    email: validateEmail(values.email),
    password: validatePassword(values.password),
    confirmPassword: values.confirmPassword
      ? (values.password === values.confirmPassword ? '' : 'Passwords do not match')
      : 'Confirm password is required',
  });

  const handleChange = (e) => {
    const nextFormData = { ...formData, [e.target.name]: e.target.value };
    setFormData(nextFormData);
    setFieldErrors(validateForm(nextFormData));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const nextErrors = validateForm(formData);
    setFieldErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
        return setError('Please fix the highlighted fields.');
    }

    setLoading(true);

    try {
      await register({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password
      });
      // register() auto-logs-in, redirect to home
      navigate('/');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 6 }}>
      <Typography variant="h4" component="h1" gutterBottom textAlign="center" fontWeight={600}>
        Create an Account
      </Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box component="form" onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
                fullWidth
                margin="normal"
                label="First Name"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                error={Boolean(fieldErrors.firstName)}
                helperText={fieldErrors.firstName}
                required
            />
            <TextField
                fullWidth
                margin="normal"
                label="Last Name"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                error={Boolean(fieldErrors.lastName)}
                helperText={fieldErrors.lastName}
                required
            />
        </Box>
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
          helperText={fieldErrors.password || 'Minimum 8 characters, at least 1 uppercase and 1 number'}
          required
        />
        <TextField
          fullWidth
          margin="normal"
          label="Confirm Password"
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
          {loading ? 'Creating account...' : 'Sign Up'}
        </Button>
        
        <Typography textAlign="center" variant="body2">
          Already have an account?{' '}
          <Box component={RouterLink} to="/login" sx={{ color: theme.palette.primary.main, textDecoration: 'none', fontWeight: 600 }}>
            Log in
          </Box>
        </Typography>
      </Box>
    </Box>
  );
};

export default RegisterPage;
