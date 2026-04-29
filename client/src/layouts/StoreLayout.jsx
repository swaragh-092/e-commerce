import { useState, useEffect } from 'react';
import { Box, AppBar, Toolbar, Typography, Button, IconButton, Badge, Menu, MenuItem, Divider, Avatar } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CloseIcon from '@mui/icons-material/Close';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import PersonIcon from '@mui/icons-material/Person';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import LogoutIcon from '@mui/icons-material/Logout';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useCart } from '../hooks/useCart';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import CategoryNav from '../components/layout/CategoryNav';
import StorefrontFooter from '../components/layout/StorefrontFooter';
import { useWishlist } from '../context/WishlistContext';
import PageService from '../services/pageService';
import { ADMIN_ACCESS_PERMISSIONS, getFirstAccessibleAdminPath } from '../utils/permissions';
import SEO from '../components/common/SEO';

const StoreLayout = () => {
  const { isAuthenticated, logout, hasAnyPermission, user } = useAuth();
  const { settings } = useSettings();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [topLinks, setTopLinks] = useState([]);
  const [accountMenuAnchor, setAccountMenuAnchor] = useState(null);
  const adminEntryPath = getFirstAccessibleAdminPath(user);
  const canAccessAdmin = hasAnyPermission(ADMIN_ACCESS_PERMISSIONS);

  const handleAccountMenuOpen = (event) => {
    setAccountMenuAnchor(event.currentTarget);
  };

  const handleAccountMenuClose = () => {
    setAccountMenuAnchor(null);
  };

  const handleLogout = () => {
    handleAccountMenuClose();
    logout();
  };

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
  const themeSettings = settings?.theme || {};
  const announcement = settings?.announcement || {};
  const showAnnouncement = announcement.enabled && !announcementDismissed;
  const navPosition  = nav.sticky !== false ? 'sticky' : 'static';
  const headerStyle = themeSettings.headerStyle || 'gradient';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <SEO />
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

      <AppBar
        position={navPosition}
        elevation={0}
        sx={{
          borderRadius: 0,
          background: (theme) => {
            if (headerStyle === 'solid') return theme.palette.primary.main;
            if (headerStyle === 'glass') return `${theme.palette.background.paper}e8`;
            return `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 58%, ${theme.palette.secondary.dark} 100%)`;
          },
          color: headerStyle === 'glass' ? 'text.primary' : '#fff',
          backdropFilter: headerStyle === 'glass' ? 'blur(14px)' : 'none',
          borderBottom: headerStyle === 'glass' ? '1px solid' : '1px solid rgba(255,255,255,0.16)',
          borderColor: headerStyle === 'glass' ? 'divider' : 'rgba(255,255,255,0.16)',
          boxShadow: headerStyle === 'glass' ? '0 12px 28px rgba(15, 23, 42, 0.08)' : '0 14px 32px rgba(15, 23, 42, 0.18)',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, md: 72 }, gap: 2 }}>
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
                sx={{
                  fontWeight: 700,
                  opacity: 0.9,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.12)', opacity: 1 },
                }}
              >
                {link.title}
              </Button>
            ))}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton color="inherit" component={RouterLink} to="/cart" sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' } }}>
              <Badge badgeContent={cartCount || 0} color="error">
                <ShoppingCartIcon />
              </Badge>
            </IconButton>
            {isAuthenticated ? (
              <>
                {settings?.features?.wishlist !== false && (
                  <IconButton color="inherit" component={RouterLink} to="/wishlist" sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' } }}>
                    <Badge badgeContent={wishlistCount || 0} color="error">
                      <FavoriteBorderIcon />
                    </Badge>
                  </IconButton>
                )}

                
                <IconButton color="inherit" onClick={handleAccountMenuOpen}>
                  <AccountCircleIcon />
                </IconButton>
                <Menu
                  anchorEl={accountMenuAnchor}
                  open={Boolean(accountMenuAnchor)}
                  onClose={handleAccountMenuClose}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  PaperProps={{
                    sx: {
                      mt: 1.5,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                      borderRadius: '8px',
                      minWidth: '220px',
                      overflow: 'hidden',
                    },
                  }}
                >
                  <Box sx={{ px: 2, py: 1.5, bgcolor: 'background.paper' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      {user?.firstName || 'My Account'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {user?.email || ''}
                    </Typography>
                  </Box>
                  <Divider />
                  <MenuItem
                    component={RouterLink}
                    to="/profile"
                    onClick={handleAccountMenuClose}
                    sx={{
                      py: 1.2,
                      px: 2,
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <PersonIcon sx={{ mr: 1.5, fontSize: '1.2rem', color: 'primary.main' }} />
                    <Typography sx={{ fontSize: '0.95rem' }}>Profile</Typography>
                  </MenuItem>
                  <MenuItem
                    component={RouterLink}
                    to="/orders"
                    onClick={handleAccountMenuClose}
                    sx={{
                      py: 1.2,
                      px: 2,
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <ShoppingBagIcon sx={{ mr: 1.5, fontSize: '1.2rem', color: 'primary.main' }} />
                    <Typography sx={{ fontSize: '0.95rem' }}>Orders</Typography>
                  </MenuItem>
                  <Divider sx={{ my: 0.5 }} />
                  <MenuItem
                    onClick={handleLogout}
                    sx={{
                      py: 1.2,
                      px: 2,
                      '&:hover': { bgcolor: 'error.light', color: 'white', opacity: 0.8 },
                    }}
                  >
                    <LogoutIcon sx={{ mr: 1.5, fontSize: '1.2rem' }} />
                    <Typography sx={{ fontSize: '0.95rem', }}>Logout</Typography>
                  </MenuItem>
                </Menu>

              </>
            ) : (
              <>
                <Button color="inherit" component={RouterLink} to="/login" sx={{ fontWeight: 700 }}>Login</Button>
                <Button
                  color="inherit"
                  component={RouterLink}
                  to="/register"
                  variant="outlined"
                  sx={{
                    fontWeight: 700,
                    borderColor: 'rgba(255,255,255,0.55)',
                    '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.12)' },
                  }}
                >
                  Register
                </Button>
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
