import { useState } from 'react';
import { Box, Typography, TextField, Button, Alert, useTheme, IconButton, InputAdornment } from '@mui/material';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getFirstAccessibleAdminPath } from '../../utils/permissions';
import { validateEmail, validateRequired } from '../../utils/authValidation';
import { getApiErrorMessage } from '../../utils/apiErrors';
import authService from '../../services/authService';
import { Visibility, VisibilityOff } from '@mui/icons-material';

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
  const [showResend, setShowResend] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({});

  const validateForm = (values) => ({
    email: validateEmail(values.email),
    password: validateRequired(values.password, 'Password'),
  });

  const handleChange = (e) => {
    const nextFormData = { ...formData, [e.target.name]: e.target.value };
    setFormData(nextFormData);
    // setFieldErrors(validateForm(nextFormData));
  };

  const handleBlur = (e) => {
    const { name } = e.target;

    setTouched(prev => ({
      ...prev,
      [name]: true
    }));

    const errors = validateForm(formData);
    setFieldErrors(errors);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nextErrors = validateForm(formData);
    setFieldErrors(nextErrors);

    // mark all fields as touched
    setTouched({
      email: true,
      password: true
    });

    setError('');
    setSuccessMsg('');
    setShowResend(false);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setLoading(true);

    try {
      await login(formData.email, formData.password);
      // For storefront login, always treat user as a customer and send to home/account
      navigate('/');
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Login failed. Please verify credentials.');
      setError(msg);
      // Show resend link if this is an email verification error
      if (msg.toLowerCase().includes('verify your email') || msg.toLowerCase().includes('verify email')) {
        setShowResend(true);
      }
    } finally {
      setLoading(false);
    }
  };
  

  const handleResend = async () => {
    if (!formData.email) {
      setError('Please enter your email address above first.');
      return;
    }
    setResending(true);
    try {
      await authService.resendVerification(formData.email);
      setError('');
      setShowResend(false);
      setSuccessMsg('Verification email sent! Check your inbox (and spam folder).');
    } catch (err) {
      setSuccessMsg('');
      setError(getApiErrorMessage(err, 'Failed to resend verification email.'));
    } finally {
      setResending(false);
    }
  };


  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 8 }}>
      {/* <Typography variant="h4" component="h1" gutterBottom textAlign="center" fontWeight={600}>
        Welcome Back
      </Typography> */}
      
      {error && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error">{error}</Alert>
          {showResend && (
            <Box sx={{ mt: 1, textAlign: 'center' }}>
              <Button
                size="small"
                variant="outlined"
                color="primary"
                disabled={resending}
                onClick={handleResend}
              >
                {resending ? 'Sending…' : 'Resend verification email'}
              </Button>
            </Box>
          )}
        </Box>
      )}
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
          onBlur={handleBlur}
          error={Boolean(touched.email && fieldErrors.email)}
          helperText={touched.email && fieldErrors.email}
          required
        />
        <TextField
            fullWidth
            margin="normal"
            label="Password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={handleChange}
            onBlur={handleBlur}
            error={Boolean(touched.password && fieldErrors.password)}
            helperText={touched.password && fieldErrors.password}
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(prev => !prev)}
                    onMouseDown={(e) => e.preventDefault()}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
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
