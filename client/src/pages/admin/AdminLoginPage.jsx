import React, { useState } from 'react';

import { Box, Typography, TextField, Button, Alert, useTheme, Paper, IconButton, InputAdornment, CircularProgress } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useNavigate, useLocation, Navigate, Link as RouterLink } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { getFirstAccessibleAdminPath } from '../../utils/permissions';
import { validateEmail, validateRequired } from '../../utils/authValidation';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { EmailOutlined, LockOutlined } from '@mui/icons-material';
import AuthPageShell from '../../components/storefront/AuthPageShell';

const AdminLoginPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { login, isAuthenticated, user, hasRole } = useAuth();
  
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // If already logged in and an admin, redirect them directly to the admin area
  if (isAuthenticated) {
    if (hasRole('admin') || hasRole('super_admin') || (user?.roles && user.roles.length > 0)) {
       const adminEntryPath = getFirstAccessibleAdminPath(user);
       return <Navigate to={adminEntryPath || '/admin'} replace />;
    }
  }

  const validateForm = (values) => ({
    email: validateEmail(values.email),
    password: validateRequired(values.password, 'Password'),
  });

  const handleChange = (e) => {
    const nextFormData = { ...formData, [e.target.name]: e.target.value };
    setFormData(nextFormData);
    setFieldErrors(validateForm(nextFormData));
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validateForm(formData);
    setFieldErrors(nextErrors);
    setError('');

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setLoading(true);

    try {
      const data = await login(formData.email, formData.password);
      
      // Enforce strict admin bounds
      const loggedUser = data.user;
      const isAdmin = loggedUser.roles && loggedUser.roles.some(r => r.name === 'admin' || r.name === 'super_admin' || r.permissions?.length > 0);
      
      if (!isAdmin) {
        // Technically they got logged in via the global auth context, 
        // but we treat this page as unauthorized. Let's show an error, 
        // but their session cookie is actually set. They can go to / to shop.
        // If we want true security, we'd log them out, but unified db means they are logged in.
        setError('Unauthorized: You do not have staff permissions.');
        setLoading(false);
        return;
      }

      const fromPath = location.state?.from?.pathname;
      const adminEntryPath = (fromPath && fromPath.startsWith('/admin')) ? fromPath : getFirstAccessibleAdminPath(loggedUser);
      navigate(adminEntryPath || '/admin', { replace: true });

    } catch (err) {
      setError(getApiErrorMessage(err, 'Login failed. Please verify credentials.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell type="admin" fullHeight>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <Typography component="label" htmlFor="admin-login-email" sx={fieldLabelSx}>
            Email Address
          </Typography>
          <TextField
            id="admin-login-email"
            fullWidth
            name="email"
            type="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={handleChange}
            error={Boolean(fieldErrors.email)}
            helperText={fieldErrors.email}
            required
            autoComplete="email"
            sx={inputSx}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailOutlined fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Typography component="label" htmlFor="admin-login-password" sx={fieldLabelSx}>
            Password
          </Typography>
          <TextField
            id="admin-login-password"
            fullWidth
            name="password"
            type={showPassword ? 'text' : 'password'}

            placeholder="Enter your password"


            value={formData.password}
            onChange={handleChange}
            error={Boolean(fieldErrors.password)}
            helperText={fieldErrors.password}
            required
            autoComplete="current-password"

            sx={inputSx}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlined fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
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
            sx={{ mt: 2.5, mb: 2, py: 1.45, borderRadius: '8px', fontWeight: 800 }}
            disabled={loading}
          >
            {loading ? <><CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> Authenticating…</> : 'Sign In'}
          </Button>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Secure area intended for authorized personnel only.
            </Typography>
          </Box>
        </Box>
    </AuthPageShell>
  );
};

export default AdminLoginPage;
