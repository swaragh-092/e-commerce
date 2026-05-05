import { useState } from 'react';
import { Box, Typography, TextField, Button, Alert, useTheme } from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { validateEmail, validatePassword, validateRequired, getPasswordChecks } from '../../utils/authValidation';
import { getApiErrorMessage } from '../../utils/apiErrors';

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
                error={Boolean(touched.firstName && fieldErrors.firstName)}
                helperText={touched.firstName && fieldErrors.firstName}
                onBlur={handleBlur}
                required
            />
            <TextField
                fullWidth
                margin="normal"
                label="Last Name"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                error={Boolean(touched.lastName && fieldErrors.lastName)}
                helperText={touched.lastName && fieldErrors.lastName}
                onBlur={handleBlur}
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
          error={Boolean(touched.email && fieldErrors.email)}
          helperText={touched.email && fieldErrors.email}
          onBlur={handleBlur}
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
          error={Boolean(touched.password && fieldErrors.password)}
          helperText={
            touched.password ? <PasswordChecklist password={formData.password} /> : ''
          }
          onBlur={handleBlur}
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
          error={Boolean(touched.confirmPassword && fieldErrors.confirmPassword)}
          helperText={touched.confirmPassword && fieldErrors.confirmPassword}
          onBlur={handleBlur}
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
