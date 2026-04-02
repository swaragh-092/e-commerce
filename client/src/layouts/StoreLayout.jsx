import { Box, AppBar, Toolbar, Typography, Button, Container } from '@mui/material';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';

const StoreLayout = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const { settings } = useSettings();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar>
          <Typography variant="h6" component={RouterLink} to="/" sx={{ flexGrow: 1, textDecoration: 'none', color: 'inherit', fontWeight: 700 }}>
            {settings?.general?.storeName || 'E-Commerce Store'}
          </Typography>
          <Box>
            {isAuthenticated ? (
              <>
                {(user?.role === 'admin' || user?.role === 'super_admin') && (
                  <Button color="inherit" component={RouterLink} to="/admin">Admin Panel</Button>
                )}
                <Button color="inherit" component={RouterLink} to="/wishlist">Wishlist</Button>
                <Button color="inherit" component={RouterLink} to="/profile">Profile</Button>
                <Button color="inherit" onClick={logout}>Logout</Button>
              </>
            ) : (
              <>
                <Button color="inherit" component={RouterLink} to="/login">Login</Button>
                <Button color="inherit" component={RouterLink} to="/register">Register</Button>
              </>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, py: 4 }}>
        <Container maxWidth="lg">
          <Outlet />
        </Container>
      </Box>

      <Box component="footer" sx={{ py: 3, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" align="center">
            © {new Date().getFullYear()} {settings?.general?.storeName || 'E-Commerce Store'}. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default StoreLayout;
