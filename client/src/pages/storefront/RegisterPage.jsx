import { useState } from 'react';
import { Box, Typography, TextField, Button, Alert, useTheme, InputAdornment, Divider } from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { validateEmail, validatePassword, validateRequired, getPasswordChecks } from '../../utils/authValidation';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { EmailOutlined, LockOutlined, PersonOutline } from '@mui/icons-material';
import AuthPageShell from '../../components/storefront/AuthPageShell';

const RegisterPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { register } = useAuth();
  
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});

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
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));

    const errors = validateForm(formData);
    setFieldErrors(errors);
  };

  const PasswordChecklist = ({ password }) => {
    const checks = getPasswordChecks(password);

    const Item = ({ valid, text }) => {
      if (!valid) {
        return (
          <Typography variant="body2" color="error.main">
            *  {text}
          </Typography>
        );
      }
    }
      

    return (
      <Box sx={{ mt: 1 }}>
        <Item valid={checks.length} text="At least 8 characters" />
        <Item valid={checks.uppercase} text="1 uppercase letter" />
        <Item valid={checks.lowercase} text="1 lowercase letter" />
        <Item valid={checks.number} text="1 number" />
        <Item valid={checks.symbol} text="1 special character" />
      </Box>
    );
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
    setError('');
    const nextErrors = validateForm(formData);
    setFieldErrors(nextErrors);

    // if (Object.values(nextErrors).some(Boolean)) {
    //     return setError('Please fix the highlighted fields.');
    // }

    setLoading(true);

    try {
      await register({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword
      });
      // register() auto-logs-in, redirect to home
      navigate('/');
    } catch (err) {
      const errData = err?.response?.data?.error;

      if (errData?.code === 'VALIDATION_ERROR' && errData?.details) {
        const errors = {};

        errData.details.forEach((d) => {
          errors[d.field] = d.message;
        });

        setFieldErrors(errors);

        // mark those fields as touched so they show
        const touchedFields = {};
        Object.keys(errors).forEach((key) => {
          touchedFields[key] = true;
        });
        setTouched(prev => ({ ...prev, ...touchedFields }));

      } else {
        setError(getApiErrorMessage(err, 'Registration failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell type="register">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box component="form" onSubmit={handleSubmit}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Box>
            <Typography component="label" htmlFor="register-first-name" sx={fieldLabelSx}>
              First Name
            </Typography>
            <TextField
                id="register-first-name"
                fullWidth
                name="firstName"
                placeholder="First name"
                value={formData.firstName}
                onChange={handleChange}
                error={Boolean(touched.firstName && fieldErrors.firstName)}
                helperText={touched.firstName && fieldErrors.firstName}
                onBlur={handleBlur}
                required
                sx={inputSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutline fontSize="small" />
                    </InputAdornment>
                  )
                }}
            />
          </Box>
          <Box>
            <Typography component="label" htmlFor="register-last-name" sx={fieldLabelSx}>
              Last Name
            </Typography>
            <TextField
                id="register-last-name"
                fullWidth
                name="lastName"
                placeholder="Last name"
                value={formData.lastName}
                onChange={handleChange}
                error={Boolean(touched.lastName && fieldErrors.lastName)}
                helperText={touched.lastName && fieldErrors.lastName}
                onBlur={handleBlur}
                required
                sx={inputSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutline fontSize="small" />
                    </InputAdornment>
                  )
                }}
            />
          </Box>
        </Box>
        <Typography component="label" htmlFor="register-email" sx={fieldLabelSx}>
          Email Address
        </Typography>
        <TextField
          id="register-email"
          fullWidth
          name="email"
          type="email"
          placeholder="Enter your email"
          value={formData.email}
          onChange={handleChange}
          error={Boolean(touched.email && fieldErrors.email)}
          helperText={touched.email && fieldErrors.email}
          onBlur={handleBlur}
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
        <Typography component="label" htmlFor="register-password" sx={fieldLabelSx}>
          Password
        </Typography>
        <TextField
          id="register-password"
          fullWidth
          name="password"
          type="password"
          placeholder="Enter your password"
          value={formData.password}
          onChange={handleChange}
          error={Boolean(touched.password && fieldErrors.password)}
          helperText={
            touched.password ? <PasswordChecklist password={formData.password} /> : ''
          }
          onBlur={handleBlur}
          required
          sx={inputSx}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockOutlined fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <Typography component="label" htmlFor="register-confirm-password" sx={fieldLabelSx}>
          Confirm Password
        </Typography>
        <TextField
          id="register-confirm-password"
          fullWidth
          name="confirmPassword"
          type="password"
          placeholder="Confirm your password"
          value={formData.confirmPassword}
          onChange={handleChange}
          error={Boolean(touched.confirmPassword && fieldErrors.confirmPassword)}
          helperText={touched.confirmPassword && fieldErrors.confirmPassword}
          onBlur={handleBlur}
          required
          sx={{ ...inputSx, mb: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockOutlined fontSize="small" />
              </InputAdornment>
            )
          }}
        />

        <Button
          fullWidth
          type="submit"
          variant="contained"
          size="large"
          sx={{ mt: 2, mb: 2, height: 52, borderRadius: '8px' }}
          disabled={loading}
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </Button>

        <Divider sx={{ my: 2.5 }}>
          <Typography variant="caption" color="text.secondary">or</Typography>
        </Divider>
        
        <Typography textAlign="center" variant="body2">
          Already have an account?{' '}
          <Box component={RouterLink} to="/login" sx={{ color: theme.palette.primary.main, textDecoration: 'none', fontWeight: 600 }}>
            Log in
          </Box>
        </Typography>
      </Box>
    </AuthPageShell>
  );
};

export default RegisterPage;
