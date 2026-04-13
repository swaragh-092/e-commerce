import React from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React error boundary caught an error', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
          <Stack spacing={2} sx={{ width: '100%', maxWidth: 520 }}>
            <Typography variant="h4" textAlign="center" fontWeight={700}>
              Something went wrong
            </Typography>
            <Alert severity="error">
              We hit an unexpected problem while rendering this page. You can reload the app or head back home.
            </Alert>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
              <Button variant="contained" onClick={this.handleReload}>Reload app</Button>
              <Button variant="outlined" onClick={this.handleGoHome}>Go home</Button>
            </Stack>
          </Stack>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
