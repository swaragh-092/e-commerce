import React, { useState } from 'react';
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
  useTheme,
  useMediaQuery,
  Collapse,
  TextField,
  InputAdornment,
  Badge,
  Menu,
  MenuItem,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Outlet, Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
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
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import PersonIcon from '@mui/icons-material/Person';
import PaymentIcon from '@mui/icons-material/Payment';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PublicIcon from '@mui/icons-material/Public';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ApiIcon from '@mui/icons-material/Api';
import MenuIcon from '@mui/icons-material/Menu';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useAuth } from '../hooks/useAuth';
import { useSettings, useMode } from '../hooks/useSettings';
import { PERMISSIONS } from '../utils/permissions';

const drawerWidth = 240;
const slimDrawerWidth = 72;

// Items with a `feature` key are hidden when that feature is disabled in Settings.
// Items with a `mode: 'ecommerce'` key are hidden entirely in catalog mode.
const MENU_STRUCTURE = [
  { text: 'Dashboard', path: '/admin', icon: <DashboardIcon />, permission: PERMISSIONS.DASHBOARD_VIEW },
  {
    title: 'Catalog',
    icon: <InventoryIcon />,
    items: [
      { text: 'Products', path: '/admin/products', icon: <InventoryIcon />, permission: PERMISSIONS.PRODUCTS_READ },
      { text: 'Categories', path: '/admin/categories', icon: <CategoryIcon />, permission: PERMISSIONS.CATEGORIES_READ },
      { text: 'Brands', path: '/admin/brands', icon: <LocalOfferIcon />, permission: PERMISSIONS.PRODUCTS_READ },
      { text: 'Attributes', path: '/admin/attributes', icon: <TuneIcon />, permission: PERMISSIONS.ATTRIBUTES_READ },
    ]
  },
  {
    title: 'Sales',
    icon: <ShoppingCartIcon />,
    items: [
      { text: 'Orders', path: '/admin/orders', icon: <ShoppingCartIcon />, permission: PERMISSIONS.ORDERS_READ, mode: 'ecommerce' },
      { text: 'Enquiries', path: '/admin/enquiries', icon: <HelpOutlineIcon />, permission: PERMISSIONS.SETTINGS_READ },
      { text: 'Customers', path: '/admin/customers', icon: <PeopleIcon />, permission: PERMISSIONS.CUSTOMERS_READ },
      { text: 'Coupons', path: '/admin/coupons', icon: <LocalOfferIcon />, feature: 'coupons', permission: PERMISSIONS.COUPONS_READ, mode: 'ecommerce' },
      { text: 'Sale Labels', path: '/admin/sale-labels', icon: <LocalOfferIcon />, permission: PERMISSIONS.SETTINGS_READ, mode: 'ecommerce' },
      { text: 'Reviews', path: '/admin/reviews', icon: <StarIcon />, feature: 'reviews', permission: PERMISSIONS.REVIEWS_READ },
    ]
  },
  {
    title: 'Content',
    icon: <DescriptionIcon />,
    items: [
      { text: 'Media', path: '/admin/media', icon: <PhotoLibraryIcon />, permission: PERMISSIONS.MEDIA_READ },
      { text: 'Pages', path: '/admin/pages', icon: <DescriptionIcon />, permission: PERMISSIONS.PAGES_READ },
      { text: 'Menu Builder', path: '/admin/menus', icon: <AccountTreeIcon />, permission: PERMISSIONS.MENUS_READ },
      { text: 'API Builder', path: '/admin/api-builder', icon: <ApiIcon />, feature: 'apiBuilder', permission: PERMISSIONS.SETTINGS_READ },
      { text: 'SEO Overrides', path: '/admin/seo-overrides', icon: <PublicIcon />, feature: 'seo', permission: PERMISSIONS.SETTINGS_READ },
    ]
  },
  {
    title: 'Blogs',
    icon: <DescriptionIcon />,
    items: [
      { text: 'Posts', path: '/admin/blogs', icon: <DescriptionIcon />, permission: PERMISSIONS.BLOGS_READ },
      { text: 'Categories', path: '/admin/blogs/categories', icon: <CategoryIcon />, permission: PERMISSIONS.BLOGS_READ },
    ]
  },
  {
    title: 'Settings',
    icon: <SettingsIcon />,
    items: [
      { text: 'Platform Features', path: '/admin/features', icon: <AdminPanelSettingsIcon />, permission: PERMISSIONS.SETTINGS_READ },
      { text: 'General', path: '/admin/settings', icon: <SettingsIcon />, permission: PERMISSIONS.SETTINGS_READ },
      { text: 'Templates', path: '/admin/email-templates', icon: <MailOutlineIcon />, permission: PERMISSIONS.SETTINGS_READ },
      { text: 'Payment Gateways', path: '/admin/payment-gateways', icon: <PaymentIcon />, permission: PERMISSIONS.SETTINGS_READ, mode: 'ecommerce' },
      { text: 'Shipping', path: '/admin/shipping', icon: <LocalShippingIcon />, permission: PERMISSIONS.SETTINGS_READ, mode: 'ecommerce' },
    ]
  },
  {
    title: 'Security',
    icon: <AdminPanelSettingsIcon />,
    items: [
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
      { text: 'Audit Log', path: '/admin/audit-log', icon: <HistoryIcon />, permission: PERMISSIONS.AUDIT_READ },
    ]
  },
];

const AdminLayout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [openGroups, setOpenGroups] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('admin_sidebar_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [groupOrder, setGroupOrder] = useState(() => {
    const saved = localStorage.getItem('admin_sidebar_group_order');
    return saved ? JSON.parse(saved) : MENU_STRUCTURE.filter(i => i.title).map(i => i.title);
  });

  const searchInputRef = React.useRef(null);

  const { logout, user, hasAnyPermission, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { settings, features } = useSettings();
  const appMode = useMode(); // 'ecommerce' | 'catalog'

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleGroupToggle = (title) => {
    setOpenGroups((prev) => {
      const isOpen = prev[title];
      return isOpen ? {} : { [title]: true };
    });
  };

  const toggleFavorite = (e, path) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path];
      localStorage.setItem('admin_sidebar_favorites', JSON.stringify(next));
      return next;
    });
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const newOrder = Array.from(groupOrder);
    const [reorderedItem] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, reorderedItem);
    setGroupOrder(newOrder);
    localStorage.setItem('admin_sidebar_group_order', JSON.stringify(newOrder));
  };

  const isActive = (path) =>
    path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path);

  // Keyboard shortcut for search (Ctrl + /)
  const [searchFocusTrigger, setSearchFocusTrigger] = React.useState(0);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        e.stopPropagation();
        setIsCollapsed(false);
        setSearchFocusTrigger((t) => t + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  React.useEffect(() => {
    if (searchFocusTrigger > 0) {
      searchInputRef.current?.focus();
    }
  }, [searchFocusTrigger]);

  // Filter and check if group should be visible
  const isItemVisible = (item) => {
    // Mode and Feature flags
    if (item.mode && item.mode !== appMode) return false;
    if (item.feature && features?.[item.feature] === false) return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    if (item.permissions && !hasAnyPermission(item.permissions)) return false;
    
    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesText = item.text?.toLowerCase().includes(query);
      const matchesTitle = item.title?.toLowerCase().includes(query);
      const hasMatchingChild = item.items?.some(child => 
        child.text.toLowerCase().includes(query) && isItemVisible(child)
      );
      return matchesText || matchesTitle || hasMatchingChild;
    }

    return true;
  };

  // Automatically expand group containing the active item OR matching search
  React.useEffect(() => {
    let newOpenGroups = {};
    
    MENU_STRUCTURE.forEach(item => {
      if (item.items) {
        const hasActiveChild = item.items.some(child => isActive(child.path));
        const hasMatchingChild = searchQuery && item.items.some(child => 
          child.text.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
        if (hasActiveChild || hasMatchingChild) {
          newOpenGroups[item.title] = true;
        }
      }
    });

    // If we found a group to open, set it. 
    // For search, we might want multiple open, so we only clear others if not searching.
    if (Object.keys(newOpenGroups).length > 0) {
      setOpenGroups(prev => {
        if (searchQuery) return { ...prev, ...newOpenGroups };
        return newOpenGroups; // Accordion behavior for navigation
      });
    }
  }, [location.pathname, searchQuery]);

  const renderMenuItem = (item, isNested = false) => {
    if (!isItemVisible(item)) return null;

    const active = isActive(item.path);
    const isFavorited = favorites.includes(item.path);

    return (
      <ListItem 
        key={item.text} 
        disablePadding 
        sx={{ 
          position: 'relative', 
          px: 1,
          '&:hover .pin-action': { opacity: 1 }
        }}
      >
        {/* Professional Active Indicator Bar */}
        {active && !isCollapsed && (
          <Box
            sx={{
              position: 'absolute',
              left: 4,
              top: '20%',
              bottom: '20%',
              width: 4,
              bgcolor: 'primary.main',
              borderRadius: 4,
              zIndex: 2,
              boxShadow: (theme) => `0 0 10px ${theme.palette.primary.main}40`,
            }}
          />
        )}
        <Tooltip title={isCollapsed ? item.text : ""} placement="right">
          <ListItemButton
            component={RouterLink}
            to={item.path}
            selected={active}
            onClick={() => isMobile && setMobileOpen(false)}
            sx={{
              borderRadius: '12px',
              mb: 0.5,
              py: 1,
              pl: isNested ? (isCollapsed ? 1.5 : 4.5) : 2.5,
              pr: isCollapsed ? 0 : 4,
              justifyContent: isCollapsed ? 'center' : 'initial',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                '& .MuiListItemIcon-root': {
                  transform: 'translateX(3px)',
                  color: 'primary.main',
                },
              },
              '&.Mui-selected': {
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                color: 'primary.main',
                '& .MuiListItemIcon-root': { color: 'primary.main', transform: 'scale(1.1)' },
                '& .MuiListItemText-primary': { color: 'primary.main', fontWeight: 700 },
              },
            }}
          >
            <ListItemIcon sx={{ 
              minWidth: isCollapsed ? 0 : 38, 
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              color: active ? 'primary.main' : 'text.secondary',
              display: 'flex',
              justifyContent: 'center',
            }}>
              {item.icon}
            </ListItemIcon>
            {!isCollapsed && (
              <ListItemText 
                primary={item.text} 
                primaryTypographyProps={{ 
                  fontSize: 13, 
                  fontWeight: active ? 700 : 500,
                }} 
              />
            )}
            
            {/* Pin Toggle */}
            {!isCollapsed && (
              <IconButton
                className="pin-action"
                size="small"
                onClick={(e) => toggleFavorite(e, item.path)}
                sx={{
                  position: 'absolute',
                  right: 8,
                  opacity: isFavorited ? 0.8 : 0,
                  transition: 'opacity 0.2s',
                  color: isFavorited ? 'primary.main' : 'text.disabled',
                  '&:hover': { color: 'primary.main' }
                }}
              >
                {isFavorited ? <PushPinIcon sx={{ fontSize: 14 }} /> : <PushPinOutlinedIcon sx={{ fontSize: 14 }} />}
              </IconButton>
            )}
          </ListItemButton>
        </Tooltip>
      </ListItem>
    );
  };

  const renderMenuSection = (section, draggableProps = {}, dragHandleProps = {}) => {
    if (section.items) {
      const visibleItems = section.items.filter(isItemVisible);
      if (visibleItems.length === 0) return null;

      const isOpen = openGroups[section.title];

      return (
        <React.Fragment key={section.title}>
          <ListItem disablePadding {...draggableProps} sx={{ mb: 0.5 }}>
            <Tooltip title={isCollapsed ? section.title : ""} placement="right">
              <ListItemButton
                onClick={() => handleGroupToggle(section.title)}
                sx={{
                  mx: 1,
                  borderRadius: 2,
                  justifyContent: isCollapsed ? 'center' : 'initial',
                  '&:hover .drag-handle': { opacity: 0.5 }
                }}
              >
                {!isCollapsed && (
                  <Box 
                    className="drag-handle" 
                    {...dragHandleProps} 
                    sx={{ 
                      mr: 1, 
                      opacity: 0, 
                      transition: 'opacity 0.2s',
                      display: 'flex',
                      cursor: 'grab',
                      '&:active': { cursor: 'grabbing' }
                    }}
                  >
                    <DragIndicatorIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                  </Box>
                )}
                <ListItemIcon sx={{ 
                  minWidth: isCollapsed ? 0 : 30, 
                  transition: 'all 0.3s ease',
                  transform: isOpen ? 'scale(1.1)' : 'none',
                  color: isOpen ? 'primary.main' : 'inherit',
                }}>
                  {section.icon}
                </ListItemIcon>
                {!isCollapsed && (
                  <>
                    <ListItemText 
                      primary={section.title} 
                      primaryTypographyProps={{ 
                        fontSize: 11, 
                        fontWeight: 700, 
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                        color: isOpen ? 'primary.main' : 'text.secondary',
                        opacity: 0.8,
                      }} 
                    />
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      transition: 'transform 0.3s ease',
                      transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                    }}>
                      <ExpandMore fontSize="small" sx={{ opacity: 0.5 }} />
                    </Box>
                  </>
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
          <Collapse in={(isOpen || !!searchQuery) && !isCollapsed} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {section.items.map(item => renderMenuItem(item, true))}
            </List>
          </Collapse>
        </React.Fragment>
      );
    }
    return renderMenuItem(section);
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, pb: 1 }}>
        {/* Collapsed: compact search icon button */}
        <Box sx={{ display: isCollapsed ? 'flex' : 'none', justifyContent: 'center' }}>
          <Tooltip title="Quick find... (Ctrl+/)" placement="right">
            <IconButton onClick={() => { setIsCollapsed(false); setTimeout(() => searchInputRef.current?.focus(), 300); }} size="small">
              <SearchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        {/* Expanded: full search field */}
        <Box sx={{ display: isCollapsed ? 'none' : 'block' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Quick find... (Ctrl+/)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            inputRef={searchInputRef}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
              sx: { 
                borderRadius: 2, 
                bgcolor: 'action.hover',
                '& fieldset': { border: 'none' },
                '& input': { fontSize: 13 },
              }
            }}
          />
        </Box>
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden', py: 1 }}>
        {/* Favorites Section */}
        {favorites.length > 0 && (
          <>
            <Box sx={{ px: 2, py: 1, display: isCollapsed ? 'none' : 'block' }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: 1.5, textTransform: 'uppercase', fontSize: 10 }}>
                Favorites
              </Typography>
            </Box>
            <List dense disablePadding>
              {MENU_STRUCTURE.flatMap(s => s.items || [s])
                .filter(i => favorites.includes(i.path))
                .map(item => renderMenuItem(item, false))}
            </List>
            <Divider sx={{ my: 1.5, mx: 2, opacity: 0.5 }} />
          </>
        )}

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="sidebar-groups">
            {(provided) => (
              <List dense {...provided.droppableProps} ref={provided.innerRef}>
                {/* Top level items (like Dashboard) */}
                {MENU_STRUCTURE.filter(i => !i.title).map(item => renderMenuItem(item))}

                {/* Reorderable Groups */}
                {groupOrder.map((groupTitle, index) => {
                  const section = MENU_STRUCTURE.find(s => s.title === groupTitle);
                  if (!section) return null;
                  
                  return (
                    <Draggable key={groupTitle} draggableId={groupTitle} index={index}>
                      {(provided) => (
                        <Box
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                        >
                          {renderMenuSection(section, {}, provided.dragHandleProps)}
                        </Box>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </List>
            )}
          </Droppable>
        </DragDropContext>


      </Box>

      <Box sx={{ mt: 'auto', borderTop: '1px solid', borderColor: 'divider', p: 1, bgcolor: 'background.paper' }}>
        <IconButton 
          onClick={handleToggleCollapse} 
          sx={{ 
            width: '100%', 
            borderRadius: 1,
            transition: 'all 0.2s',
            '&:hover': { bgcolor: 'primary.lighter', color: 'primary.main' }
          }}
        >
          {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1, borderRadius: 0 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            {settings?.logo?.main ? (
              <img
                src={settings.logo.main}
                alt={settings?.general?.storeName || 'Admin'}
                style={{ maxHeight: 32, maxWidth: 120, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : null}
            <Typography variant="h6" noWrap sx={{ fontWeight: 700, display: { xs: 'none', md: 'block' } }}>
              Admin Dashboard
            </Typography>
          </Box>
          <Tooltip title="View Store">
            <IconButton color="inherit" component={RouterLink} to="/" sx={{ mr: 1 }}>
              <StoreIcon />
            </IconButton>
          </Tooltip>
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0 }}>
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'secondary.main', fontSize: 14 }}>
              {user?.firstName?.[0]?.toUpperCase() || 'A'}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {user?.email}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { setAnchorEl(null); navigate('/admin/profile'); }}>
              <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
              My Profile
            </MenuItem>
            <MenuItem onClick={() => { setAnchorEl(null); logout(); }}>
              <ListItemIcon><ExitIcon fontSize="small" /></ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            borderRight: 'none',
          },
        }}
      >
        <Toolbar />
        {drawerContent}
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: isCollapsed ? slimDrawerWidth : drawerWidth,
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: isCollapsed ? slimDrawerWidth : drawerWidth,
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
            overflowX: 'hidden',
            bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(20, 20, 20, 0.8)',
            backdropFilter: 'blur(10px)',
          },
        }}
      >
        <Toolbar />
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          bgcolor: 'background.default',
          minHeight: '100vh',
          width: { xs: '100%', md: `calc(100% - ${isCollapsed ? slimDrawerWidth : drawerWidth}px)` },
          maxWidth: { xs: '100%', md: 'none' },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default AdminLayout;
