import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Tooltip,
  IconButton,
} from '@mui/material';
import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import InventoryIcon from '@mui/icons-material/Inventory';
import CategoryIcon from '@mui/icons-material/Category';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PeopleIcon from '@mui/icons-material/People';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import StarIcon from '@mui/icons-material/Star';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import SettingsIcon from '@mui/icons-material/Settings';
import HistoryIcon from '@mui/icons-material/History';
import TuneIcon from '@mui/icons-material/Tune';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import StoreIcon from '@mui/icons-material/Storefront';
import ExitIcon from '@mui/icons-material/ExitToApp';
import DescriptionIcon from '@mui/icons-material/Description';
import PaymentIcon from '@mui/icons-material/Payment';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PublicIcon from '@mui/icons-material/Public';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { PERMISSIONS } from '../utils/permissions';

const drawerWidth = 240;

// Items with a `feature` key are hidden when that feature is disabled in Settings.
const ALL_MENU_ITEMS = [
  { text: 'Dashboard',  path: '/admin',            icon: <DashboardIcon />, permission: PERMISSIONS.DASHBOARD_VIEW },
  { text: 'Products',   path: '/admin/products',   icon: <InventoryIcon />, permission: PERMISSIONS.PRODUCTS_READ },
  { text: 'Categories', path: '/admin/categories', icon: <CategoryIcon />, permission: PERMISSIONS.CATEGORIES_READ },
  { text: 'Brands',     path: '/admin/brands',     icon: <LocalOfferIcon />, permission: PERMISSIONS.PRODUCTS_READ },
  { text: 'Attributes', path: '/admin/attributes', icon: <TuneIcon />, permission: PERMISSIONS.ATTRIBUTES_READ },
  { text: 'Orders',     path: '/admin/orders',     icon: <ShoppingCartIcon />, permission: PERMISSIONS.ORDERS_READ },
  { text: 'Enquiries',  path: '/admin/enquiries',  icon: <HelpOutlineIcon />, permission: PERMISSIONS.SETTINGS_READ },
  { text: 'Customers',  path: '/admin/customers',  icon: <PeopleIcon />, permission: PERMISSIONS.CUSTOMERS_READ },
  { text: 'Coupons',    path: '/admin/coupons',    icon: <LocalOfferIcon />, feature: 'coupons', permission: PERMISSIONS.COUPONS_READ },
  { text: 'Sale Labels',path: '/admin/sale-labels',icon: <LocalOfferIcon />, permission: PERMISSIONS.SETTINGS_READ },
  { text: 'Reviews',    path: '/admin/reviews',    icon: <StarIcon />, feature: 'reviews', permission: PERMISSIONS.REVIEWS_READ },
  { text: 'Media',      path: '/admin/media',      icon: <PhotoLibraryIcon />, permission: PERMISSIONS.MEDIA_READ },
  { text: 'SEO Overrides',path: '/admin/seo-overrides',icon: <PublicIcon />, feature: 'seo', permission: PERMISSIONS.SETTINGS_READ },
  { text: 'Settings',       path: '/admin/settings',          icon: <SettingsIcon />, permission: PERMISSIONS.SETTINGS_READ },
  { text: 'Email Templates',  path: '/admin/email-templates',   icon: <MailOutlineIcon />, permission: PERMISSIONS.SETTINGS_READ },
  { text: 'Payment Gateways', path: '/admin/payment-gateways', icon: <PaymentIcon />, permission: PERMISSIONS.SETTINGS_READ },
  { text: 'Shipping',         path: '/admin/shipping',         icon: <LocalShippingIcon />, permission: PERMISSIONS.SETTINGS_READ },
  { text: 'Pages',            path: '/admin/pages',            icon: <DescriptionIcon />, permission: PERMISSIONS.PAGES_READ },
  {
    text: 'Access Control',
    path: '/admin/access-control',
    icon: <AdminPanelSettingsIcon />,
    permissions: [
      PERMISSIONS.ROLES_READ,
      PERMISSIONS.ROLES_MANAGE,
      PERMISSIONS.SYSTEM_ROLES_MANAGE,
      PERMISSIONS.USERS_ASSIGN_ROLES,
    ],
  },
  { text: 'Audit Log',  path: '/admin/audit-log',  icon: <HistoryIcon />, permission: PERMISSIONS.AUDIT_READ },
];

const AdminLayout = () => {
  const { logout, user, hasAnyPermission, hasPermission } = useAuth();
  const location = useLocation();
  const { settings } = useSettings();

  // Hide feature-gated items when the feature is explicitly disabled
  const menuItems = ALL_MENU_ITEMS.filter(
    (item) => (
      (!item.feature || settings?.features?.[item.feature] !== false)
      && (!item.permission || hasPermission(item.permission))
      && (!item.permissions || hasAnyPermission(item.permissions))
    )
  );

  const isActive = (path) =>
    path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path);

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1, borderRadius: 0 }}>
        <Toolbar>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            {settings?.logo?.main ? (
              <img
                src={settings.logo.main}
                alt={settings?.general?.storeName || 'Admin'}
                style={{ maxHeight: 32, maxWidth: 120, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : null}
            <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
              Admin Dashboard
            </Typography>
          </Box>
          <Tooltip title="View Store">
            <IconButton color="inherit" component={RouterLink} to="/" sx={{ mr: 1 }}>
              <StoreIcon />
            </IconButton>
          </Tooltip>
          <Avatar sx={{ width: 34, height: 34, bgcolor: 'secondary.main', fontSize: 14 }}>
            {user?.firstName?.[0]?.toUpperCase() || 'A'}
          </Avatar>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', py: 1 }}>
          <List dense>
            {menuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  component={RouterLink}
                  to={item.path}
                  selected={isActive(item.path)}
                  sx={{
                    mx: 1,
                    borderRadius: 2,
                    mb: 0.25,
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                      '&:hover': { bgcolor: 'primary.dark' },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: 14 }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider sx={{ my: 1 }} />
          <List dense>
            <ListItem disablePadding>
              <ListItemButton onClick={logout} sx={{ mx: 1, borderRadius: 2 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <ExitIcon />
                </ListItemIcon>
                <ListItemText primary="Logout" primaryTypographyProps={{ fontSize: 14 }} />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, bgcolor: 'background.default', minHeight: '100vh' }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default AdminLayout;
