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
import StoreIcon from '@mui/icons-material/Storefront';
import ExitIcon from '@mui/icons-material/ExitToApp';
import { useAuth } from '../hooks/useAuth';

const drawerWidth = 240;

const menuItems = [
  { text: 'Dashboard', path: '/admin', icon: <DashboardIcon /> },
  { text: 'Products', path: '/admin/products', icon: <InventoryIcon /> },
  { text: 'Categories', path: '/admin/categories', icon: <CategoryIcon /> },
  { text: 'Attributes', path: '/admin/attributes', icon: <TuneIcon /> },
  { text: 'Orders', path: '/admin/orders', icon: <ShoppingCartIcon /> },
  { text: 'Customers', path: '/admin/customers', icon: <PeopleIcon /> },
  { text: 'Coupons', path: '/admin/coupons', icon: <LocalOfferIcon /> },
  { text: 'Reviews', path: '/admin/reviews', icon: <StarIcon /> },
  { text: 'Media', path: '/admin/media', icon: <PhotoLibraryIcon /> },
  { text: 'Settings', path: '/admin/settings', icon: <SettingsIcon /> },
  { text: 'Audit Log', path: '/admin/audit-log', icon: <HistoryIcon /> },
];

const AdminLayout = () => {
  const { logout, user } = useAuth();
  const location = useLocation();

  const isActive = (path) =>
    path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path);

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1, fontWeight: 700 }}>
            Admin Dashboard
          </Typography>
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
