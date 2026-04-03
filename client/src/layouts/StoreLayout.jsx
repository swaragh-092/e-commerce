import { Box, AppBar, Toolbar, Typography, Button, IconButton, Badge } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useCart } from '../hooks/useCart';
import CategoryNav from '../components/layout/CategoryNav';

const StoreLayout = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const { settings } = useSettings();
  const { cartCount } = useCart();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar>
          <Box component={RouterLink} to="/" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit', gap: 1 }}>
            {settings?.logo?.main ? (
              <img
                src={settings.logo.main}
                alt={settings?.general?.storeName || 'Store'}
                style={{ maxHeight: 36, maxWidth: 140, objectFit: 'contain' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {settings?.general?.storeName || 'E-Commerce Store'}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton color="inherit" component={RouterLink} to="/cart">
              <Badge badgeContent={cartCount || 0} color="error">
                <ShoppingCartIcon />
              </Badge>
            </IconButton>
            {isAuthenticated ? (
              <>
                {(user?.role === 'admin' || user?.role === 'super_admin') && (
                  <Button color="inherit" component={RouterLink} to="/admin">Admin Panel</Button>
                )}
                {settings?.features?.wishlist !== false && (
                  <Button color="inherit" component={RouterLink} to="/wishlist">Wishlist</Button>
                )}
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
      {/* <CategoryNav /> */}

      <Box component="main" sx={{ flexGrow: 1 }}>
        <Outlet />
      </Box>

      <Box component="footer" sx={{ py: 3, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ maxWidth: 'lg', mx: 'auto', px: 3 }}>
          <Typography variant="body2" color="text.secondary" align="center">
            © {new Date().getFullYear()} {settings?.general?.storeName || 'E-Commerce Store'}. All rights reserved.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default StoreLayout;
