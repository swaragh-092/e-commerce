import { useState } from 'react';
import { Box, Typography, TextField, Button, Alert, useTheme } from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const RegisterPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { register } = useAuth();
  
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
        return setError("Passwords do not match");
    }

    setLoading(true);

    try {
      await register({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password
      });
      // Redirect to login with a success state message
      navigate('/login', { state: { message: 'Registration successful! Please log in.' } });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
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
                required
            />
            <TextField
                fullWidth
                margin="normal"
                label="Last Name"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
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
          helperText="Minimum 8 characters, at least 1 uppercase and 1 number"
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
