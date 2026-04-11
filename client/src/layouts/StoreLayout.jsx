import { useState, useEffect } from 'react';
import { Box, AppBar, Toolbar, Typography, Button, IconButton, Badge } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CloseIcon from '@mui/icons-material/Close';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useCart } from '../hooks/useCart';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import CategoryNav from '../components/layout/CategoryNav';
import StorefrontFooter from '../components/layout/StorefrontFooter';
import { useWishlist } from '../context/WishlistContext';
import PageService from '../services/pageService';

const StoreLayout = () => {
  const { isAuthenticated, logout, hasPermission } = useAuth();
  const { settings } = useSettings();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [topLinks, setTopLinks] = useState([]);

  useEffect(() => {
    const fetchTopLinks = async () => {
      try {
        const response = await PageService.getPublicPages('top');
        setTopLinks(response.data || []);
      } catch (error) {
        console.error('Error fetching top links:', error);
      }
    };
    fetchTopLinks();
  }, []);

  const nav          = settings?.nav          || {};
  const announcement = settings?.announcement || {};
  const showAnnouncement = announcement.enabled && !announcementDismissed;
  const navPosition  = nav.sticky !== false ? 'sticky' : 'static';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Announcement Bar */}
      {showAnnouncement && (
        <Box sx={{
          bgcolor: announcement.bgColor || 'primary.dark',
          color: announcement.fgColor || '#fff',
          py: 0.75, px: 2,
          textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 1, position: 'relative',
        }}>
          {announcement.link ? (
            <Typography variant="body2" component={RouterLink} to={announcement.link}
              sx={{ color: 'inherit', textDecoration: 'underline', '&:hover': { opacity: 0.85 } }}>
              {announcement.text}
            </Typography>
          ) : (
            <Typography variant="body2">{announcement.text}</Typography>
          )}
          {announcement.dismissible !== false && (
            <IconButton size="small" onClick={() => setAnnouncementDismissed(true)}
              sx={{ color: 'inherit', position: 'absolute', right: 8, p: 0.5 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      )}

      <AppBar position={navPosition} color="primary" elevation={0}>
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
          <Box sx={{ display: 'none', md: 'flex', alignItems: 'center', gap: 2, mr: 3 }}>
            {topLinks.map((link) => (
              <Button
                key={link.id}
                color="inherit"
                component={RouterLink}
                to={`/p/${link.slug}`}
                sx={{ textTransform: 'none', fontWeight: 500 }}
              >
                {link.title}
              </Button>
            ))}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton color="inherit" component={RouterLink} to="/cart">
              <Badge badgeContent={cartCount || 0} color="error">
                <ShoppingCartIcon />
              </Badge>
            </IconButton>
            {isAuthenticated ? (
              <>
                {hasPermission('dashboard.view') && (
                  <Button color="inherit" component={RouterLink} to="/admin">Admin Panel</Button>
                )}
                {settings?.features?.wishlist !== false && (
                  <Button color="inherit" component={RouterLink} to="/wishlist" startIcon={<Badge badgeContent={wishlistCount || 0} color="error"><FavoriteBorderIcon /></Badge>}>
                    Wishlist
                  </Button>
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
      {nav.showCategoryBar && <CategoryNav />}

      <Box component="main" sx={{ flexGrow: 1 }}>
        <Outlet />
      </Box>

      <StorefrontFooter />
    </Box>
  );
};

export default StoreLayout;
