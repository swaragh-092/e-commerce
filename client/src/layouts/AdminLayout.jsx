import { Box, AppBar, Toolbar, Typography, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider } from '@mui/material';
import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import StoreIcon from '@mui/icons-material/Storefront';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import ExitIcon from '@mui/icons-material/ExitToApp';
import { useAuth } from '../hooks/useAuth';

const drawerWidth = 240;

const AdminLayout = () => {
  const { logout } = useAuth();
  const location = useLocation();

  const menuItems = [
    { text: 'Dashboard', path: '/admin', icon: <DashboardIcon /> },
    { text: 'Users', path: '/admin/users', icon: <PeopleIcon /> },
    { text: 'Settings', path: '/admin/settings', icon: <SettingsIcon /> },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Admin Dashboard
          </Typography>
          <Typography variant="body2" component={RouterLink} to="/" sx={{ color: 'inherit', textDecoration: 'none', mr: 2, display: 'flex', alignItems: 'center' }}>
            <StoreIcon sx={{ mr: 1 }} /> View Store
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton 
                    component={RouterLink} 
                    to={item.path}
                    selected={location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== '/admin')}
                >
                  <ListItemIcon>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider />
          <List>
            <ListItem disablePadding>
              <ListItemButton onClick={logout}>
                <ListItemIcon><ExitIcon /></ListItemIcon>
                <ListItemText primary="Logout" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default AdminLayout;
