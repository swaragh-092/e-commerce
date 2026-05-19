import { useState } from 'react';
import { Box, Typography, TextField, Button, Alert, useTheme, IconButton, InputAdornment, CircularProgress, Divider, Checkbox } from '@mui/material';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { validateEmail, validateRequired } from '../../utils/authValidation';
import { getApiErrorMessage } from '../../utils/apiErrors';
import authService from '../../services/authService';
import { EmailOutlined, LockOutlined, Visibility, VisibilityOff } from '@mui/icons-material';
import AuthPageShell from '../../components/storefront/AuthPageShell';

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
  const [rememberMe, setRememberMe] = useState(false);

  const validateForm = (values) => ({
    email: validateEmail(values.email),
    password: validateRequired(values.password, 'Password'),
  });

  const handleChange = (e) => {
    const nextFormData = { ...formData, [e.target.name]: e.target.value };
    setFormData(nextFormData);
    // setFieldErrors(validateForm(nextFormData));
  };

  const inputSx = {
    mb: 2.25,
    '& .MuiOutlinedInput-root': {
      height: 48,
      borderRadius: '8px',
      bgcolor: '#fff',
      '& fieldset': { borderColor: 'rgba(100, 116, 139, 0.24)' },
      '&:hover fieldset': { borderColor: 'rgba(15, 118, 110, 0.42)' },
      '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, borderWidth: 1 },
    },
    '& .MuiInputBase-input': { fontSize: 14 },
  };

  const fieldLabelSx = {
    display: 'block',
    mb: 0.75,
    color: '#334155',
    fontWeight: 700,
    fontSize: 13,
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
      // Redirect to the page the user was trying to access, or home
      const redirectTo = location.state?.from?.pathname || '/';
      navigate(redirectTo, { replace: true });
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
    <AuthPageShell type="login">
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
      {successMsg && <Alert severity={location.state?.sessionExpired ? 'info' : 'success'} sx={{ mb: 2 }}>{successMsg}</Alert>}

      <Box component="form" onSubmit={handleSubmit}>
        <Typography component="label" htmlFor="login-email" sx={fieldLabelSx}>
          Email Address
        </Typography>
        <TextField
          id="login-email"
          fullWidth
          name="email"
          type="email"
          placeholder="Enter your email"
          value={formData.email}
          onChange={handleChange}
          onBlur={handleBlur}
          error={Boolean(touched.email && fieldErrors.email)}
          helperText={touched.email && fieldErrors.email}
          required
          sx={inputSx}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <EmailOutlined fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <Typography component="label" htmlFor="login-password" sx={fieldLabelSx}>
          Password
        </Typography>
        <TextField
            id="login-password"
            fullWidth
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            onBlur={handleBlur}
            error={Boolean(touched.password && fieldErrors.password)}
            helperText={touched.password && fieldErrors.password}
            required
            sx={{ ...inputSx, mb: 1.5 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlined fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
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
        
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5, mb: 2.5, gap: 2 }}>
          <Box
            component="label"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: '#334155', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            <Checkbox
              size="small"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              sx={{ p: 0, color: 'rgba(100, 116, 139, 0.45)' }}
            />
            Remember me
          </Box>
          <Typography variant="body2" component={RouterLink} to="/forgot-password" sx={{ textDecoration: 'none', color: theme.palette.primary.main }}>
            Forgot password?
          </Typography>
        </Box>

        <Button
          fullWidth
          type="submit"
          variant="contained"
          size="large"
          sx={{ mt: 0, mb: 2, height: 52, borderRadius: '8px' }}
          disabled={loading}
        >
          {loading ? <><CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> Logging in…</> : 'Log In'}
        </Button>

        <Divider sx={{ my: 2.5 }}>
          <Typography variant="caption" color="text.secondary">or</Typography>
        </Divider>
        
        <Typography textAlign="center" variant="body2">
          Don't have an account?{' '}
          <Box component={RouterLink} to="/register" sx={{ color: theme.palette.primary.main, textDecoration: 'none', fontWeight: 600 }}>
            Sign up
          </Box>
        </Typography>
      </Box>
    </AuthPageShell>
  );
};

export default LoginPage;
