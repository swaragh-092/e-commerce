import { useEffect, useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CloseIcon from '@mui/icons-material/Close';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import PersonIcon from '@mui/icons-material/Person';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import LogoutIcon from '@mui/icons-material/Logout';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MenuIcon from '@mui/icons-material/Menu';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSettings, useFeature, useCurrency } from '../../hooks/useSettings';
import { useCart } from '../../hooks/useCart';
import { useWishlist } from '../../context/WishlistContext';
import { useCategories } from '../../context/CategoryContext';
import SearchWidget from '../search/SearchWidget';
import CategoryNav from './CategoryNav';
import PageService from '../../services/pageService';
import MenuService from '../../services/menuService';
import { isExternalUrl } from '../../utils/urls';
import { getStoreName } from '../../utils/store';
import { resolveShippingAnnouncement } from '../../utils/shippingAnnouncement';

const DEFAULT_ACTIONS_ORDER = ['search', 'cart', 'wishlist', 'account'];
const DEFAULT_HEADER_ELEMENT_ORDER = ['logo', 'menu', 'actions'];

/**
 * The single header renderer used by the public storefront and the designer.
 * `preview` only changes interaction behavior; it does not change layout.
 */
const StorefrontHeader = ({ preview = false, onSelectComponent }) => {
  const { isAuthenticated, logout, user } = useAuth();
  const { settings } = useSettings();
  const { formatPrice } = useCurrency();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { error: categoryError } = useCategories();
  const cartEnabled = useFeature('cart');
  const wishlistEnabled = useFeature('wishlist');
  const ordersEnabled = useFeature('orders');
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [topLinks, setTopLinks] = useState([]);
  const [headerMenu, setHeaderMenu] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(null);
  const [menuAnchors, setMenuAnchors] = useState({});
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState(null);
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [accountMenuAnchor, setAccountMenuAnchor] = useState(null);

  const select = (event, component) => {
    if (!onSelectComponent) return;
    event?.preventDefault();
    event?.stopPropagation();
    onSelectComponent(component);
  };

  useEffect(() => {
    let mounted = true;
    const fetchNavigation = async () => {
      const [headerMenuResult, mobileMenuResult, pageResult] = await Promise.allSettled([
        MenuService.getPublicMenu('header'),
        MenuService.getPublicMenu('mobile'),
        PageService.getPublicPages('top'),
      ]);
      if (!mounted) return;
      if (headerMenuResult.status === 'fulfilled') setHeaderMenu(headerMenuResult.value.data || null);
      if (mobileMenuResult.status === 'fulfilled') setMobileMenu(mobileMenuResult.value.data || null);
      if (pageResult.status === 'fulfilled') setTopLinks(pageResult.value.data || []);
    };
    fetchNavigation().catch((error) => console.error('Error fetching storefront navigation:', error));
    return () => { mounted = false; };
  }, []);

  const nav = settings?.nav || {};
  const showSearch = nav.showSearch !== false;
  const showAccount = nav.showAccount !== false;
  const showCart = nav.showCart !== false && cartEnabled;
  const showWishlist = nav.showWishlist === true && wishlistEnabled && isAuthenticated;
  const actionsOrder = Array.isArray(nav.actionsOrder) && nav.actionsOrder.length
    ? [...new Set([...nav.actionsOrder, ...DEFAULT_ACTIONS_ORDER])].filter((key) => DEFAULT_ACTIONS_ORDER.includes(key))
    : DEFAULT_ACTIONS_ORDER;
  const themeSettings = settings?.theme || {};
  const announcement = settings?.announcement || {};
  const announcementText = resolveShippingAnnouncement({ announcement, shipping: settings?.shipping, formatPrice });
  const headerTemplate = nav.template || 'classic';
  const showAnnouncement = (announcement.enabled || headerTemplate === 'announcement') && Boolean(announcementText) && !announcementDismissed;
  const navPosition = nav.sticky !== false ? 'sticky' : 'static';
  const headerStyle = themeSettings.headerStyle || 'gradient';
  const logoPosition = nav.logoPosition || (headerTemplate === 'centered-logo' ? 'center' : 'left');
  const showHeaderSearch = showSearch && headerTemplate !== 'minimal';
  const showTemplateCategoryBar = nav.showCategoryBar === true || headerTemplate === 'mega-menu';
  const menuGap = nav.menuSpacing === 'compact' ? 0.25 : nav.menuSpacing === 'spacious' ? 1.5 : 0.75;
  const headerToolbarHeight = nav.headerHeight === 'compact'
    ? { xs: 56, md: 64 }
    : nav.headerHeight === 'tall'
      ? { xs: 72, md: 88 }
      : { xs: 64, md: 72 };
  const announcementAtTop = announcement.position !== 'bottom';
  const hasDynamicHeaderItems = Array.isArray(headerMenu?.items) && headerMenu.items.length > 0;
  const headerItems = hasDynamicHeaderItems
    ? headerMenu.items
    : topLinks.map((link, index) => ({
        id: link.id,
        label: link.title,
        url: `/p/${link.slug}`,
        targetType: 'page',
        placement: 'center',
        sortOrder: index,
        children: [],
      }));
  const groupedHeaderItems = {
    left: headerItems.filter((item) => item.placement === 'left'),
    center: headerItems.filter((item) => !item.placement || item.placement === 'center'),
    right: headerItems.filter((item) => item.placement === 'right'),
  };
  const desktopHeaderItems = [...groupedHeaderItems.left, ...groupedHeaderItems.center, ...groupedHeaderItems.right];
  const headerAlignment = nav.menuPosition || headerMenu?.alignment || 'left';
  const headerElementOrder = Array.isArray(nav.elementOrder) && nav.elementOrder.length
    ? [...new Set([...nav.elementOrder, ...DEFAULT_HEADER_ELEMENT_ORDER])].filter((key) => DEFAULT_HEADER_ELEMENT_ORDER.includes(key))
    : DEFAULT_HEADER_ELEMENT_ORDER;
  const headerElementOrderValue = (key) => (headerElementOrder.indexOf(key) + 1) * 10;
  const hasDedicatedMobileItems = Array.isArray(mobileMenu?.items) && mobileMenu.items.length > 0;
  const mobileHeaderItems = hasDedicatedMobileItems ? mobileMenu.items : desktopHeaderItems;
  const storeName = nav.logoText || getStoreName(settings);

  const getLinkProps = (item) => {
    if (preview) {
      return {
        component: 'button',
        type: 'button',
        onClick: (event) => select(event, 'headerMenu'),
      };
    }
    const url = item.url || '/';
    if (item.targetType === 'none' || url === '#') return { component: 'button', type: 'button' };
    if (isExternalUrl(url)) {
      return { component: 'a', href: url, target: item.openInNewTab ? '_blank' : undefined, rel: item.openInNewTab ? 'noopener noreferrer' : undefined };
    }
    return { component: RouterLink, to: url };
  };
  const isNavigableItem = (item) => item.targetType !== 'none' && item.url && item.url !== '#';

  const openDynamicMenu = (event, itemId) => {
    if (preview) return select(event, 'headerMenu');
    setMenuAnchors((prev) => ({ ...prev, [itemId]: event.currentTarget }));
  };
  const closeDynamicMenu = (itemId) => setMenuAnchors((prev) => ({ ...prev, [itemId]: null }));
  const openMobileMenu = (event) => {
    if (preview) return select(event, 'headerMenu');
    setMobileMenuAnchor(event.currentTarget);
  };
  const closeMobileMenu = () => setMobileMenuAnchor(null);
  const openAccountMenu = (event) => {
    if (preview) return select(event, 'headerActions');
    setAccountMenuAnchor(event.currentTarget);
  };
  const closeAccountMenu = () => setAccountMenuAnchor(null);

  const renderDynamicMenuItems = (items = [], parentId, depth = 0) => items.map((item) => {
    const hasChildren = item.children?.length > 0;
    const navigable = isNavigableItem(item);
    return (
      <Box key={item.id}>
        <MenuItem
          {...(navigable ? getLinkProps(item) : { component: 'div' })}
          onClick={navigable ? () => closeDynamicMenu(parentId) : undefined}
          sx={{ pl: 2 + depth * 2 }}
        >
          {item.label}
        </MenuItem>
        {hasChildren && renderDynamicMenuItems(item.children, parentId, depth + 1)}
      </Box>
    );
  });

  const renderHeaderLinks = (items = []) => items.map((item) => {
    const hasChildren = item.children?.length > 0;
    if (hasChildren) {
      return (
        <Box key={item.id}>
          <Button
            color="inherit"
            endIcon={<ExpandMoreIcon />}
            onClick={(event) => openDynamicMenu(event, item.id)}
            sx={{ fontWeight: 700, color: 'inherit', whiteSpace: 'nowrap', minWidth: 'auto', opacity: 0.9, px: 1.25, '&:hover': { bgcolor: 'rgba(255,255,255,0.12)', opacity: 1 } }}
          >
            {item.label}
          </Button>
          {!preview && (
            <Menu anchorEl={menuAnchors[item.id]} open={Boolean(menuAnchors[item.id])} onClose={() => closeDynamicMenu(item.id)}>
              {isNavigableItem(item) && <MenuItem {...getLinkProps(item)} onClick={() => closeDynamicMenu(item.id)} sx={{ fontWeight: 700 }}>All {item.label}</MenuItem>}
              {isNavigableItem(item) && <Divider />}
              {renderDynamicMenuItems(item.children, item.id)}
            </Menu>
          )}
        </Box>
      );
    }
    return (
      <Button
        key={item.id}
        color="inherit"
        {...getLinkProps(item)}
        sx={{ flexShrink: 0, fontWeight: 700, color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap', minWidth: 'auto', opacity: 0.9, px: 1.25, '&:hover': { bgcolor: 'rgba(255,255,255,0.12)', opacity: 1 } }}
      >
        {item.label}
      </Button>
    );
  });

  const renderMobileMenuItems = (items = [], depth = 0) => items.map((item) => {
    const hasChildren = item.children?.length > 0;
    const navigable = isNavigableItem(item);
    return (
      <Box key={item.id}>
        <MenuItem
          {...(navigable ? getLinkProps(item) : { component: 'div' })}
          onClick={navigable ? closeMobileMenu : undefined}
          sx={{ pl: 2 + depth * 2, fontWeight: depth === 0 ? 700 : 400 }}
        >
          {item.label}
        </MenuItem>
        {hasChildren && renderMobileMenuItems(item.children, depth + 1)}
      </Box>
    );
  });

  const renderAnnouncementBar = () => {
    if (!showAnnouncement) return null;
    return (
      <Box sx={{ bgcolor: announcement.bgColor || 'primary.dark', color: announcement.fgColor || '#fff', py: 0.75, px: 2, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, position: 'relative', minHeight: 40 }}>
        {announcement.link && !preview ? (
          <Typography variant="body2" component={RouterLink} to={announcement.link} sx={{ color: 'inherit', textDecoration: 'underline', '&:hover': { opacity: 0.85 } }}>{announcementText}</Typography>
        ) : (
          <Typography variant="body2">{announcementText}</Typography>
        )}
        {announcement.dismissible !== false && (
          <IconButton size="small" onClick={(event) => preview ? select(event, 'announcementBar') : setAnnouncementDismissed(true)} aria-label="Dismiss announcement" sx={{ color: 'inherit', position: 'absolute', right: 8, p: 0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    );
  };

  return (
    <>
      {announcementAtTop && renderAnnouncementBar()}
      <AppBar
        position={preview ? 'static' : navPosition}
        elevation={0}
        onClick={(event) => preview && select(event, 'headerLayout')}
        sx={{
          borderRadius: 0,
          background: (theme) => {
            if (nav.bgColor) return nav.bgColor;
            if (headerStyle === 'solid') return theme.palette.primary.main;
            if (headerStyle === 'glass') return `${theme.palette.background.paper}e8`;
            return `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 58%, ${theme.palette.secondary.dark} 100%)`;
          },
          color: nav.fgColor || (headerStyle === 'glass' ? 'text.primary' : '#fff'),
          backdropFilter: headerStyle === 'glass' ? 'blur(14px)' : 'none',
          borderBottom: '1px solid',
          borderColor: nav.borderColor || (headerStyle === 'glass' ? 'divider' : 'rgba(255,255,255,0.16)'),
          boxShadow: nav.shadow === 'none' ? 'none' : (headerStyle === 'glass' ? '0 12px 28px rgba(15, 23, 42, 0.08)' : '0 14px 32px rgba(15, 23, 42, 0.18)'),
          cursor: preview && onSelectComponent ? 'pointer' : 'default',
        }}
      >
        <Toolbar sx={{ minHeight: headerToolbarHeight, gap: { xs: 0.5, sm: 1, md: 2 }, px: { xs: 1, sm: 2 }, position: 'relative', justifyContent: 'space-between' }}>
          <Box
            component={preview ? 'button' : RouterLink}
            {...(preview ? { type: 'button', onClick: (event) => select(event, 'headerLogo') } : { to: '/' })}
            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit', gap: 1, flexShrink: 0, minWidth: 0, order: headerElementOrderValue('logo'), border: preview ? 0 : undefined, background: preview ? 'transparent' : undefined, cursor: preview ? 'pointer' : 'inherit', ...(logoPosition === 'center' ? { position: 'absolute', left: '50%', transform: 'translateX(-50%)' } : {}), ...(logoPosition === 'right' ? { order: 3, ml: 'auto' } : {}) }}
          >
            {settings?.logo?.main && !logoLoadFailed ? (
              <img src={settings.logo.main} alt={storeName} style={{ maxHeight: 36, maxWidth: nav.logoMaxWidth || 140, objectFit: 'contain' }} onError={() => setLogoLoadFailed(true)} />
            ) : null}
            {nav.showStoreName !== false && (
              <Typography variant="h6" noWrap sx={{ fontWeight: 700, maxWidth: { xs: 110, sm: 180 } }}>{storeName}</Typography>
            )}
          </Box>

          <Box
            component="nav"
            aria-label="Main navigation"
            onClick={(event) => preview && select(event, 'headerMenu')}
            sx={{ display: { xs: 'none', md: headerTemplate === 'centered-logo' ? 'none' : 'flex' }, alignItems: 'center', gap: menuGap, overflowX: 'auto', whiteSpace: 'nowrap', scrollbarWidth: 'thin', '&::-webkit-scrollbar': { height: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.25)', borderRadius: 1 }, ...(headerAlignment === 'center' ? { position: 'absolute', left: '50%', transform: 'translateX(-50%)', maxWidth: { md: 'calc(100% - 560px)', lg: 'calc(100% - 680px)', xl: 'calc(100% - 720px)' } } : { minWidth: { md: 120, lg: 200 }, flexShrink: 1 }), order: headerElementOrderValue('menu') }}
          >
            {renderHeaderLinks(desktopHeaderItems)}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.125, sm: 0.5 }, flexShrink: 0, order: headerElementOrderValue('actions'), ml: 'auto' }}>
            {showHeaderSearch && (
              <Box onClick={(event) => preview && select(event, 'headerActions')} sx={{ display: { xs: 'none', md: 'flex' }, width: { md: 200, lg: 320 }, flexShrink: 0, mx: 1, pointerEvents: preview ? 'none' : 'auto' }}>
                <SearchWidget variant="header" headerStyle={headerStyle} />
              </Box>
            )}
            {mobileHeaderItems.length > 0 && (
              <>
                <IconButton color="inherit" onClick={openMobileMenu} sx={{ display: { xs: 'inline-flex', md: 'none' }, p: { xs: 0.75, sm: 1 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' } }} aria-label="Open navigation menu"><MenuIcon /></IconButton>
                {!preview && (
                  <Menu anchorEl={mobileMenuAnchor} open={Boolean(mobileMenuAnchor)} onClose={closeMobileMenu} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} PaperProps={{ sx: { mt: 1, minWidth: 220 } }}>
                    {renderMobileMenuItems(mobileHeaderItems)}
                  </Menu>
                )}
              </>
            )}
            {actionsOrder.map((actionKey) => {
              if (actionKey === 'search') {
                return showHeaderSearch ? <Box key="search" sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', pointerEvents: preview ? 'none' : 'auto' }}><SearchWidget variant="header" headerStyle={headerStyle} placeholder="Search..." collapseToIcon fullWidth={false} onExpandedChange={setIsMobileSearchExpanded} sx={{ width: { xs: 'min(168px, calc(100vw - 172px))', sm: 180 } }} /></Box> : null;
              }
              if (actionKey === 'cart') {
                return showCart && !isMobileSearchExpanded ? <IconButton key="cart" color="inherit" component={preview ? 'button' : RouterLink} {...(preview ? { type: 'button', onClick: (event) => select(event, 'headerActions') } : { to: '/cart' })} sx={{ p: { xs: 0.75, sm: 1 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' } }} aria-label="Cart"><Badge badgeContent={cartCount || 0} color="error"><ShoppingCartIcon /></Badge></IconButton> : null;
              }
              if (actionKey === 'wishlist') {
                return showWishlist && !isMobileSearchExpanded ? <IconButton key="wishlist" color="inherit" component={preview ? 'button' : RouterLink} {...(preview ? { type: 'button', onClick: (event) => select(event, 'headerActions') } : { to: '/wishlist' })} sx={{ p: { xs: 0.75, sm: 1 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' } }} aria-label="Wishlist"><Badge badgeContent={wishlistCount || 0} color="error"><FavoriteBorderIcon /></Badge></IconButton> : null;
              }
              if (actionKey === 'account') {
                if (isAuthenticated) return showAccount && !isMobileSearchExpanded ? <IconButton key="account" color="inherit" onClick={openAccountMenu} sx={{ p: { xs: 0.75, sm: 1 } }} aria-label="Account"><AccountCircleIcon /></IconButton> : null;
                return showAccount ? <Box key="account" sx={{ display: 'flex', alignItems: 'center', pointerEvents: preview ? 'none' : 'auto' }}><Button color="inherit" component={preview ? 'button' : RouterLink} {...(preview ? { type: 'button', onClick: (event) => select(event, 'headerActions') } : { to: '/login' })} sx={{ fontWeight: 700 }}>Login</Button><Button color="inherit" component={preview ? 'button' : RouterLink} {...(preview ? { type: 'button', onClick: (event) => select(event, 'headerActions') } : { to: '/register' })} variant="outlined" sx={{ fontWeight: 700, borderColor: 'rgba(255,255,255,0.55)', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.12)' } }}>Register</Button></Box> : null;
              }
              return null;
            })}
            {!preview && isAuthenticated && (
              <Menu anchorEl={accountMenuAnchor} open={Boolean(accountMenuAnchor)} onClose={closeAccountMenu} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} PaperProps={{ sx: { mt: 1.5, minWidth: 220, overflow: 'hidden' } }}>
                <Box sx={{ px: 2, py: 1.5, bgcolor: 'background.paper' }}><Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.95rem' }}>{user?.firstName || 'My Account'}</Typography><Typography variant="caption" color="text.secondary">{user?.email || ''}</Typography></Box>
                <Divider />
                <MenuItem component={RouterLink} to="/profile" onClick={closeAccountMenu}><PersonIcon sx={{ mr: 1.5, fontSize: '1.2rem', color: 'primary.main' }} />Profile</MenuItem>
                {ordersEnabled && <MenuItem component={RouterLink} to="/orders" onClick={closeAccountMenu}><ShoppingBagIcon sx={{ mr: 1.5, fontSize: '1.2rem', color: 'primary.main' }} />Orders</MenuItem>}
                <Divider sx={{ my: 0.5 }} />
                <MenuItem onClick={() => { closeAccountMenu(); logout(); }}><LogoutIcon sx={{ mr: 1.5, fontSize: '1.2rem' }} />Logout</MenuItem>
              </Menu>
            )}
          </Box>
        </Toolbar>
        {headerTemplate === 'centered-logo' && nav.showMenu !== false && (
          <Box component="nav" aria-label="Main navigation" onClick={(event) => preview && select(event, 'headerMenu')} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center', gap: menuGap, px: 2, py: 1, bgcolor: nav.bgColor || 'background.paper', color: nav.fgColor || 'text.primary', borderBottom: '1px solid', borderColor: nav.borderColor || 'divider', pointerEvents: preview ? 'auto' : undefined }}>
            {renderHeaderLinks(desktopHeaderItems)}
          </Box>
        )}
      </AppBar>
      {showTemplateCategoryBar && (
        <Box onClick={(event) => preview && select(event, 'headerMenu')} sx={{ pointerEvents: preview ? 'auto' : undefined }}>
          <CategoryNav />
          {categoryError && <Typography role="alert" sx={{ bgcolor: 'error.main', color: '#fff', textAlign: 'center', px: 2, py: 0.5, fontSize: '0.8rem' }}>{categoryError}</Typography>}
        </Box>
      )}
      {!announcementAtTop && renderAnnouncementBar()}
    </>
  );
};

export default StorefrontHeader;
