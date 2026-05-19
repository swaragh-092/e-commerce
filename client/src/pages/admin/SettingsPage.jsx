import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import {
  Alert,
  Box,
  Typography,
  Paper,
  Tab,
  Tabs,
  TextField,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Divider,
  Grid,
  InputAdornment,
  Autocomplete,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PublicIcon from '@mui/icons-material/Public';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
// import { Link } from 'react-router-dom';
import { updateSettings, getEmailTemplates, updateEmailTemplate, sendTestEmail as sendTestEmailApi } from '../../services/adminService';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { SettingsContext } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { useIsSuperAdmin } from '../../hooks/useAuth';
import { useMode } from '../../hooks/useSettings';
import { PERMISSIONS } from '../../utils/permissions';
import { DASHBOARD_PROFILES } from '../../components/admin/dashboard/dashboardWidgets';
import MessagingSettingsPanel from '../../components/admin/settings/MessagingSettingsPanel';
import MediaPicker from '../../components/common/MediaPicker';
import { getMediaUrl } from '../../utils/media';

const CURRENCIES = [
  { code: 'USD', symbol: '$',  name: 'US Dollar' },
  { code: 'INR', symbol: '₹',  name: 'Indian Rupee' },
  { code: 'EUR', symbol: '€',  name: 'Euro' },
  { code: 'GBP', symbol: '£',  name: 'British Pound' },
  { code: 'JPY', symbol: '¥',  name: 'Japanese Yen' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'BDT', symbol: '৳',  name: 'Bangladeshi Taka' },
  { code: 'PKR', symbol: '₨',  name: 'Pakistani Rupee' },
];

const getCurrencySymbol = (code) =>
  CURRENCIES.find((c) => c.code === code)?.symbol || code || '$';

// helper: treat undefined/null as the fallback, 'false'/'0' as false
const bool = (val, fallback = true) =>
  val === undefined || val === null ? fallback : val !== false && val !== 'false' && val !== '0';

const MASKED_SECRET = '********';

const isMaskedSecret = (value) =>
  typeof value === 'string' && value.trim() === MASKED_SECRET;

const FONTS = [
  'Roboto',
  'Inter',
  'Open Sans',
  'Lato',
  'Poppins',
  'Montserrat',
  'Source Sans Pro',
  'Ubuntu',
  'IBM Plex Sans',
  'Work Sans',
  'Quicksand',
  'Raleway',
];

const THEME_PRESETS = [
  {
    name: 'Premium Retail',
    description: 'Warm storefront with emerald actions and coral accents.',
    values: {
      'theme.mode': 'light',
      'theme.primaryColor': '#0f766e',
      'theme.secondaryColor': '#f97316',
      'theme.backgroundColor': '#f7f3ec',
      'theme.surfaceColor': '#fffaf2',
      'theme.textColor': '#1f2933',
      'theme.fontFamily': 'Inter',
      'theme.borderRadius': '12px',
      'theme.headerStyle': 'gradient',
      'theme.buttonStyle': 'solid',
      'theme.cardStyle': 'elevated',
      'theme.backgroundStyle': 'softGradient',
    },
  },
  {
    name: 'Clean Minimal',
    description: 'Bright, simple, and product-first.',
    values: {
      'theme.mode': 'light',
      'theme.primaryColor': '#111827',
      'theme.secondaryColor': '#2563eb',
      'theme.backgroundColor': '#f8fafc',
      'theme.surfaceColor': '#ffffff',
      'theme.textColor': '#111827',
      'theme.fontFamily': 'Inter',
      'theme.borderRadius': '8px',
      'theme.headerStyle': 'solid',
      'theme.buttonStyle': 'solid',
      'theme.cardStyle': 'outlined',
      'theme.backgroundStyle': 'solid',
    },
  },
  {
    name: 'Luxury Dark',
    description: 'Dark premium theme with gold accents.',
    values: {
      'theme.mode': 'dark',
      'theme.primaryColor': '#d4af37',
      'theme.secondaryColor': '#8b5cf6',
      'theme.backgroundColor': '#0f1115',
      'theme.surfaceColor': '#181b22',
      'theme.textColor': '#f8fafc',
      'theme.fontFamily': 'Montserrat',
      'theme.borderRadius': '10px',
      'theme.headerStyle': 'gradient',
      'theme.buttonStyle': 'solid',
      'theme.cardStyle': 'elevated',
      'theme.backgroundStyle': 'softGradient',
    },
  },
];

const DASHBOARD_ORDER_WIDGETS = [
  { id: 'salesChart', label: 'Sales Overview', description: 'Revenue and order trend chart' },
  { id: 'recentOrders', label: 'Recent Orders', description: 'Latest order activity and statuses' },
  { id: 'operationsSummary', label: 'Operations Summary', description: 'Pending payments, stock, customers, and catalog totals' },
  { id: 'inventoryWarnings', label: 'Inventory Warnings', description: 'Critical and low inventory shortcuts' },
  { id: 'storeHealth', label: 'Store Health', description: 'Configuration and operational readiness checks' },
  { id: 'lowStock', label: 'Low Stock Alerts', description: 'Inventory items that need attention' },
];

const HOMEPAGE_SECTION_TYPES = [
  { value: 'hero-carousel', label: 'Hero Carousel' },
  { value: 'value-props', label: 'Trust / Value Props' },
  { value: 'category-shortcuts', label: 'Category Shortcuts' },
  { value: 'promo-banners', label: 'Promo Banners' },
  { value: 'product-row', label: 'Product Row' },
  { value: 'brand-showcase', label: 'Brand Showcase' },
];

const HOMEPAGE_PRODUCT_SOURCES = [
  { value: 'featured', label: 'Featured Products' },
  { value: 'sale', label: 'Deals / On Sale' },
  { value: 'bestSellers', label: 'Best Sellers' },
  { value: 'newest', label: 'New Arrivals' },
  { value: 'recommended', label: 'Recommended' },
];

const HOMEPAGE_VALUE_ICONS = [
  'shipping',
  'offers',
  'secure',
  'support',
  'fast',
  'payment',
  'verified',
];

const DEFAULT_HOMEPAGE_SECTIONS = [
  { id: 'hero', type: 'hero-carousel', enabled: true, autoPlay: true, interval: 6500 },
  { id: 'value-props', type: 'value-props', enabled: true },
  { id: 'categories', type: 'category-shortcuts', enabled: true, title: 'Shop by Category', count: 10 },
  { id: 'promo', type: 'promo-banners', enabled: true, title: 'Offers You Shouldn\'t Miss' },
  { id: 'trending', type: 'product-row', enabled: true, title: 'Trending Now', source: 'featured', count: 8, layout: 'carousel', viewAllLabel: 'View All', viewAllLink: '/products?featured=true' },
  { id: 'deals', type: 'product-row', enabled: true, title: 'Deals of the Day', source: 'sale', count: 8, layout: 'grid', viewAllLabel: 'All Deals', viewAllLink: '/products?onSale=true' },
  { id: 'brands', type: 'brand-showcase', enabled: true, title: 'Featured Brands', count: 12 },
  { id: 'new-arrivals', type: 'product-row', enabled: true, title: 'New Arrivals', source: 'newest', count: 8, layout: 'grid', viewAllLabel: 'New In', viewAllLink: '/products?sort=newest' },
];

const DEFAULT_HOMEPAGE_VALUE_PROPS = [
  { id: 'vp-1', icon: 'shipping', title: 'Fast Delivery', text: 'Reliable shipping on every order' },
  { id: 'vp-2', icon: 'offers', title: 'Daily Offers', text: 'Fresh deals across top categories' },
  { id: 'vp-3', icon: 'secure', title: 'Secure Payments', text: 'Protected checkout experience' },
  { id: 'vp-4', icon: 'support', title: 'Easy Support', text: 'Help when shoppers need it' },
];

const DEFAULT_HOMEPAGE_PROMOS = [
  { id: 'pr-1', kicker: 'Limited Time', title: 'Flat 40% Off', subtitle: 'Season-ready looks and daily essentials.', ctaText: 'Grab Offers', link: '/products?onSale=true', color: '#FFF7ED', accentColor: '#F97316' },
  { id: 'pr-2', kicker: 'Curated', title: 'New Brands Live', subtitle: 'Fresh labels and collections added every week.', ctaText: 'Explore Brands', link: '/brands', color: '#ECFEFF', accentColor: '#0891B2' },
  { id: 'pr-3', kicker: 'Smooth Shopping', title: 'Wishlist to Checkout', subtitle: 'Search, save, cart, and buy with fewer steps.', ctaText: 'Start Shopping', link: '/products', color: '#F0FDF4', accentColor: '#16A34A' },
];

const parseDashboardOrder = (value) => {
  const saved = String(value || '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => DASHBOARD_ORDER_WIDGETS.some((widget) => widget.id === id));

  return [
    ...saved,
    ...DASHBOARD_ORDER_WIDGETS.map((widget) => widget.id).filter((id) => !saved.includes(id)),
  ];
};

const SettingsPage = () => {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [templateSaving, setTemplateSaving] = useState({});
  const [templateTestEmail, setTemplateTestEmail] = useState('');
  const [templateTesting, setTemplateTesting] = useState({});
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerKey, setMediaPickerKey] = useState(null);
  const { notify } = useNotification();
  const { refreshSettings, features: resolvedFeatures } = useContext(SettingsContext) || {};
  const { hasPermission } = useAuth();
  const appMode = useMode();
  const isSuperAdmin = useIsSuperAdmin();
  const canManageSettings = hasPermission(PERMISSIONS.SETTINGS_MANAGE);

  useEffect(() => {
    api.get('/settings').then((res) => {
      const raw = res.data.data || {};
      const flat = {};
      Object.entries(raw).forEach(([group, keys]) => {
        if (typeof keys === 'object') {
          Object.entries(keys).forEach(([k, v]) => {
            flat[`${group}.${k}`] = v;
          });
        }
      });
      setForm((f) => ({
        ...flat,
        // Patch features.* with the mode-resolved map from ThemeContext.
        // This ensures features that are OFF by default in catalog mode render
        // as OFF, not as whatever stale value default.json / DB had before.
        ...Object.fromEntries(
          Object.entries(resolvedFeatures || {}).map(([k, v]) => [`features.${k}`, v])
        ),
      }));
    });
    // Load email templates
    getEmailTemplates()
      .then((res) => setEmailTemplates(res.data?.data || []))
      .catch(() => {});
  }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const applyThemePreset = (preset) => setForm((f) => ({ ...f, ...preset.values }));
  const dashboardOrder = parseDashboardOrder(form['admin.dashboard.widgetOrder']);
  const setDashboardOrder = (order) => set('admin.dashboard.widgetOrder', order.join(','));
  const applyDashboardProfile = (profileKey) => {
    const profile = DASHBOARD_PROFILES[profileKey];
    if (!profile) return;
    setForm((current) => ({
      ...current,
      'admin.dashboard.profile': profileKey,
      'admin.dashboard.widgetOrder': profile.widgetOrder,
      'admin.dashboard.showStatCards': profile.widgetDefaults.showStatCards,
      'admin.dashboard.showRevenueCard': profile.widgetDefaults.showRevenueCard,
      'admin.dashboard.showOrdersCard': profile.widgetDefaults.showOrdersCard,
      'admin.dashboard.showCustomersCard': profile.widgetDefaults.showCustomersCard,
      'admin.dashboard.showProductsCard': profile.widgetDefaults.showProductsCard,
      'admin.dashboard.showSalesChart': profile.widgetDefaults.showSalesChart,
      'admin.dashboard.showRecentOrders': profile.widgetDefaults.showRecentOrders,
      'admin.dashboard.showOperationsSummary': profile.widgetDefaults.showOperationsSummary,
      'admin.dashboard.showInventoryWarnings': profile.widgetDefaults.showInventoryWarnings,
      'admin.dashboard.showStoreHealth': profile.widgetDefaults.showStoreHealth,
      'admin.dashboard.showLowStockAlerts': profile.widgetDefaults.showLowStockAlerts,
    }));
  };
  const handleDashboardOrderDragEnd = ({ source, destination }) => {
    if (!destination || destination.index === source.index) return;
    const nextOrder = [...dashboardOrder];
    const [moved] = nextOrder.splice(source.index, 1);
    nextOrder.splice(destination.index, 0, moved);
    setDashboardOrder(nextOrder);
  };

  const handleSave = async () => {
    if (!canManageSettings) {
      notify('You do not have permission to manage settings.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = Object.entries(form).map(([flatKey, value]) => {
        const [group, ...keyParts] = flatKey.split('.');
        return { group, key: keyParts.join('.'), value };
      }).filter(({ value }) => !isMaskedSecret(value));
      await updateSettings(payload);
      notify('Settings saved successfully.', 'success');
      // Refresh theme settings in real-time
      if (refreshSettings) {
        await refreshSettings();
      }
    } catch (e) {
      notify('Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };



  const allTabs = ['Store', 'SEO', 'Branding', 'Layout', 'Homepage', 'Catalog', 'Checkout', 'Promotions', 'Invoice', 'Advanced', 'Notifications'];
  const visibleTabs = [
    ...allTabs.filter(t => appMode === 'ecommerce' || !['Checkout', 'Promotions', 'Invoice'].includes(t))
  ];
  const safeTabIndex = tab < visibleTabs.length ? tab : 0;
  const currentTab = visibleTabs[safeTabIndex];
  const originalIndex = allTabs.indexOf(currentTab);
  const isMessagingTab = currentTab === 'Notifications';

  // Current currency symbol — used in shipping adornments
  const currSymbol = getCurrencySymbol(form['general.currency']);
  const field = (key, label, type = 'text', extra = {}) => (
    <TextField
      key={key}
      fullWidth
      size="small"
      label={label}
      type={type}
      value={form[key] ?? ''}
      onChange={(e) => set(key, e.target.value)}
      sx={{ mb: 2 }}
      {...extra}
    />
  );

  const imageField = (key, label) => (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{label}</Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          fullWidth
          size="small"
          value={form[key] ?? ''}
          onChange={(e) => set(key, e.target.value)}
          placeholder="Image URL..."
          InputProps={{
            startAdornment: form[key] && (
              <InputAdornment position="start">
                <Box 
                  component="img" 
                  src={getMediaUrl(form[key])} 
                  sx={{ width: 24, height: 24, objectFit: 'contain', borderRadius: 0.5, border: '1px solid', borderColor: 'divider' }} 
                />
              </InputAdornment>
            )
          }}
        />
        <Button 
          variant="outlined" 
          size="small"
          onClick={() => {
            setMediaPickerKey(key);
            setMediaPickerOpen(true);
          }}
          sx={{ flexShrink: 0, height: 40 }}
        >
          Pick Media
        </Button>
      </Box>
    </Box>
  );

  const handleMediaSelect = (media) => {
    if (!media || !media.length) return;
    const selected = media[0];
    if (mediaPickerKey) {
      set(mediaPickerKey, selected.url);
    }
  };

  const getHomepageSections = () => {
    if (Array.isArray(form['homepage.sections']) && form['homepage.sections'].length) {
      return form['homepage.sections'];
    }

    return DEFAULT_HOMEPAGE_SECTIONS.map((section) => {
      if (section.id === 'categories') {
        return {
          ...section,
          enabled: bool(form['homepage.showCategories'], section.enabled),
          title: form['homepage.categoriesTitle'] || section.title,
          count: Number(form['homepage.categoriesCount'] || section.count),
        };
      }
      if (section.id === 'new-arrivals') {
        return {
          ...section,
          enabled: bool(form['homepage.showNewArrivals'], section.enabled),
          title: form['homepage.newArrivalsTitle'] || section.title,
          count: Number(form['homepage.newArrivalsCount'] || section.count),
          layout: form['homepage.newArrivalsLayout'] || section.layout,
          viewAllLink: form['homepage.newArrivalsLink'] || section.viewAllLink,
        };
      }
      if (section.id === 'trending') {
        return {
          ...section,
          enabled: bool(form['homepage.showFeatured'], section.enabled),
          title: form['homepage.featuredTitle'] || section.title,
          count: Number(form['homepage.featuredCount'] || section.count),
          layout: form['homepage.featuredLayout'] || section.layout,
          viewAllLink: form['homepage.featuredLink'] || section.viewAllLink,
        };
      }
      if (section.id === 'deals') {
        return {
          ...section,
          enabled: bool(form['homepage.showOnSale'], section.enabled),
          title: form['homepage.onSaleTitle'] || section.title,
          count: Number(form['homepage.onSaleCount'] || section.count),
          layout: form['homepage.onSaleLayout'] || section.layout,
          viewAllLink: form['homepage.onSaleLink'] || section.viewAllLink,
        };
      }
      if (section.id === 'brands') {
        return {
          ...section,
          enabled: bool(form['homepage.showBrands'], section.enabled),
          title: form['homepage.brandsTitle'] || section.title,
          count: Number(form['homepage.brandsCount'] || section.count),
        };
      }
      return section;
    });
  };

  const setHomepageSections = (sections) => set('homepage.sections', sections);
  const updateHomepageSection = (index, patch) => {
    const sections = getHomepageSections();
    setHomepageSections(sections.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };
  const removeHomepageSection = (index) => {
    setHomepageSections(getHomepageSections().filter((_, itemIndex) => itemIndex !== index));
  };
  const moveHomepageSection = (index, direction) => {
    const sections = [...getHomepageSections()];
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= sections.length) return;
    const [moved] = sections.splice(index, 1);
    sections.splice(nextIndex, 0, moved);
    setHomepageSections(sections);
  };
  const addHomepageSection = () => {
    const nextIndex = getHomepageSections().length + 1;
    setHomepageSections([
      ...getHomepageSections(),
      { id: `custom-${Date.now()}`, type: 'product-row', enabled: true, title: `Product Section ${nextIndex}`, source: 'newest', count: 8, layout: 'grid', viewAllLink: '/products' },
    ]);
  };

  const getHeroSlides = () => {
    if (Array.isArray(form['homepage.heroSlides']) && form['homepage.heroSlides'].length) {
      return form['homepage.heroSlides'];
    }
    return [{
      eyebrow: form['homepage.eyebrow'] || 'Mega Style Weekend',
      title: form['hero.title'] || 'Shop the Latest',
      subtitle: form['hero.subtitle'] || 'Discover thousands of products at great prices.',
      buttonText: form['hero.buttonText'] || 'Shop Now',
      buttonLink: form['hero.buttonLink'] || '/products',
      secondaryButtonText: '',
      secondaryButtonLink: '',
      image: form['hero.backgroundImage'] || '',
      position: 'center',
      color: form['hero.color'] || '#ffffff',
    }];
  };
  const setHeroSlides = (slides) => set('homepage.heroSlides', slides);
  const updateHeroSlide = (index, patch) => {
    setHeroSlides(getHeroSlides().map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };
  const addHeroSlide = () => {
    setHeroSlides([
      ...getHeroSlides(),
      { eyebrow: 'New Collection', title: 'Your next hero banner', subtitle: 'Promote a launch, sale, or category.', buttonText: 'Shop Now', buttonLink: '/products', secondaryButtonText: '', secondaryButtonLink: '', image: '', position: 'center', color: '#ffffff' },
    ]);
  };
  const removeHeroSlide = (index) => setHeroSlides(getHeroSlides().filter((_, itemIndex) => itemIndex !== index));

  const getHomepagePromos = () => {
    const raw = Array.isArray(form['homepage.promoBanners']) && form['homepage.promoBanners'].length ? form['homepage.promoBanners'] : DEFAULT_HOMEPAGE_PROMOS;
    return raw.map(p => ({ ...p, id: p.id || `promo-${Math.random().toString(36).substr(2, 9)}` }));
  };
  const setHomepagePromos = (promos) => set('homepage.promoBanners', promos);
  const updateHomepagePromo = (index, patch) => {
    setHomepagePromos(getHomepagePromos().map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };
  const addHomepagePromo = () => {
    setHomepagePromos([...getHomepagePromos(), { id: `promo-${Math.random().toString(36).substr(2, 9)}`, kicker: 'Offer', title: 'New Promo', subtitle: 'Add a short promotion message.', ctaText: 'Shop Now', link: '/products', color: '#F8FAFC', accentColor: brandPrimary }]);
  };
  const removeHomepagePromo = (index) => setHomepagePromos(getHomepagePromos().filter((_, itemIndex) => itemIndex !== index));

  const getValueProps = () => {
    const raw = Array.isArray(form['homepage.valueProps']) && form['homepage.valueProps'].length ? form['homepage.valueProps'] : DEFAULT_HOMEPAGE_VALUE_PROPS;
    return raw.map(v => ({ ...v, id: v.id || `vp-${Math.random().toString(36).substr(2, 9)}` }));
  };
  const setValueProps = (items) => set('homepage.valueProps', items);
  const updateValueProp = (index, patch) => {
    setValueProps(getValueProps().map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };
  const addValueProp = () => {
    setValueProps([...getValueProps(), { id: `vp-${Math.random().toString(36).substr(2, 9)}`, icon: 'verified', title: 'New Benefit', text: 'Describe the shopper benefit.' }]);
  };
  const removeValueProp = (index) => setValueProps(getValueProps().filter((_, itemIndex) => itemIndex !== index));

  const toggle = (key, label) => (
    <FormControlLabel
      key={key}
      control={<Switch checked={Boolean(form[key])} onChange={(e) => set(key, e.target.checked)} />}
      label={label}
      sx={{ mb: 1 }}
    />
  );



  const section = (title, description, content, keywords = []) => ({ title, description, content, keywords });

  const renderSections = (sections) => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = !query
      ? sections
      : sections.filter((s) => [s.title, s.description, ...(s.keywords || [])].join(' ').toLowerCase().includes(query));

    if (filtered.length === 0) {
      return (
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            No settings found
          </Typography>
          <Typography variant="body2">
            Try a different search like logo, tax, shipping, footer, sale, hero, or checkout.
          </Typography>
        </Paper>
      );
    }

    return filtered.map((s) => (
      <Paper key={s.title} variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 2.5, boxShadow: 'none' }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          {s.title}
        </Typography>
        {s.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            {s.description}
          </Typography>
        )}
        {s.content}
      </Paper>
    ));
  };

  const links = Array.isArray(form['footer.links']) ? form['footer.links'] : [];
  const setLinks = (v) => set('footer.links', v);
  const themeMode = form['theme.mode'] || 'light';
  const brandPrimary = form['theme.primaryColor'] || '#6C63FF';
  const brandSecondary = form['theme.secondaryColor'] || '#FF6584';
  const pageBackground = form['theme.backgroundColor'] || (themeMode === 'dark' ? '#0F0F1A' : '#F7F8FC');
  const surfaceColor = form['theme.surfaceColor'] || (themeMode === 'dark' ? '#1A1A2E' : '#FFFFFF');
  const textColor = form['theme.textColor'] || (themeMode === 'dark' ? '#FFFFFF' : '#1A1A1A');
  const heroTextColor = form['hero.color'] || '#FFFFFF';
  const fontFamily = form['theme.fontFamily'] || 'Inter';
  const borderRadius = Number.parseInt(form['theme.borderRadius'], 10) || 12;
  const headerStyle = form['theme.headerStyle'] || 'gradient';
  const buttonStyle = form['theme.buttonStyle'] || 'solid';
  const cardStyle = form['theme.cardStyle'] || 'elevated';
  const backgroundStyle = form['theme.backgroundStyle'] || 'softGradient';
  const storeName = form['general.storeName'] || 'My Store';
  const storeDescription = form['general.storeDescription'] || 'Premium online shopping experience';
  const heroTitle = form['hero.title'] || 'Shop the Latest';
  const heroSubtitle = form['hero.subtitle'] || 'Discover thousands of products at great prices.';
  const heroButtonText = form['hero.buttonText'] || 'Shop Now';
  const footerTagline = form['footer.tagline'] || 'Premium online shopping experience.';
  const saleLabel = form['sales.defaultSaleLabel'] || 'Limited Time Offer';
  const addToCartLabel = form['productPage.addToCartLabel'] || 'Add to Cart';
  const buyNowLabel = form['productPage.buyNowLabel'] || 'Buy Now';
  const announcementEnabled = Boolean(form['announcement.enabled']);
  const stickyHeader = Boolean(form['nav.sticky']);
  const showCategoryBar = Boolean(form['nav.showCategoryBar']);
  const footerEnabled = Boolean(form['footer.enabled']);
  const footerShowLinks = Boolean(form['footer.showLinks']);
  const showProductSku = Boolean(form['productPage.showSKU']);
  const showStockBadge = Boolean(form['productPage.showStockBadge']);
  const showBuyNowButton = form['productPage.showBuyNowButton'] !== false;
  const taxInclusive = Boolean(form['tax.inclusive']);
  const guestCheckoutEnabled = Boolean(form['features.guestCheckout']);
  const couponsEnabled = Boolean(form['features.coupons']);
  const showSaleLabelBadge = Boolean(form['sales.showSaleLabel']);
  const showDiscountPercentBadge = Boolean(form['sales.showDiscountPercent']);
  const showSavingsAmount = Boolean(form['sales.showSavingsAmount']);
  const showSaleTiming = Boolean(form['sales.showSaleTiming']);
  const showCountdown = Boolean(form['sales.showCountdown']);
  const enableCGST = Boolean(form['tax.enableCGST']);
  const enableSGST = Boolean(form['tax.enableSGST']);
  const enableIGST = Boolean(form['tax.enableIGST']);
  const previewStyles = {
    fontFamily: `"${fontFamily}", "Roboto", "Helvetica", "Arial", sans-serif`,
    background: backgroundStyle === 'softGradient'
      ? `linear-gradient(180deg, ${pageBackground} 0%, ${surfaceColor} 100%)`
      : pageBackground,
    color: textColor,
    borderRadius: `${borderRadius}px`,
  };
  const previewHeaderBackground = headerStyle === 'gradient'
    ? `linear-gradient(135deg, ${brandPrimary}, ${brandSecondary})`
    : headerStyle === 'glass'
      ? `${surfaceColor}dd`
      : brandPrimary;
  const previewButtonSx = {
    bgcolor: buttonStyle === 'soft' ? `${brandPrimary}22` : brandPrimary,
    color: buttonStyle === 'soft' ? brandPrimary : '#fff',
    border: buttonStyle === 'outline' ? `1px solid ${brandPrimary}` : '1px solid transparent',
    borderRadius: `${Math.max(borderRadius - 2, 4)}px`,
  };
  const previewCardSx = {
    bgcolor: surfaceColor,
    borderRadius: `${borderRadius}px`,
    border: cardStyle === 'flat' ? '1px solid transparent' : '1px solid',
    borderColor: cardStyle === 'elevated' ? 'transparent' : 'divider',
    boxShadow: cardStyle === 'elevated' ? '0 16px 34px rgba(0,0,0,0.14)' : 'none',
  };
  const homepageSections = getHomepageSections();
  const heroSlides = getHeroSlides();
  const homepagePromos = getHomepagePromos();
  const homepageValueProps = getValueProps();
  const primaryHeroSlide = heroSlides[0] || {};

  const formatMoney = (amount) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: form['general.currency'] || 'USD',
        minimumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currSymbol}${Number(amount).toFixed(2)}`;
    }
  };

  const previewPanel = () => {
    const previewContainerSx = {
      ...previewStyles,
      p: 2,
      border: '1px solid',
      borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      overflow: 'hidden',
      boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
    };

    if (currentTab === 'Store' || currentTab === 'Branding') {
      return (
        <Box sx={previewContainerSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>Storefront Header</Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color: textColor }}>{storeName}</Typography>
            </Box>
            {form['logo.main'] ? (
              <Box component="img" src={form['logo.main']} alt="Logo" sx={{ maxWidth: 72, maxHeight: 36, objectFit: 'contain' }} />
            ) : (
              <Box sx={{ px: 1.5, py: 0.75, background: previewHeaderBackground, color: headerStyle === 'glass' ? textColor : '#fff', borderRadius: 2, fontWeight: 700 }}>Logo</Box>
            )}
          </Box>
          <Box sx={{ ...previewCardSx, p: 2, mb: 2 }}>
            <Typography variant="body2" sx={{ color: textColor, fontWeight: 600 }}>{storeDescription}</Typography>
            <Typography variant="caption" sx={{ color: themeMode === 'dark' ? 'rgba(255,255,255,0.7)' : 'text.secondary' }}>
              {form['general.contactEmail'] || 'hello@store.com'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box sx={{ flex: 1, p: 1.5, ...previewButtonSx, textAlign: 'center', fontWeight: 700 }}>Primary</Box>
            <Box sx={{ flex: 1, p: 1.5, bgcolor: brandSecondary, color: '#fff', borderRadius: 2, textAlign: 'center', fontWeight: 700 }}>Accent</Box>
          </Box>
        </Box>
      );
    }

    if (currentTab === 'Layout') {
      return (
        <Box sx={previewContainerSx}>
          {announcementEnabled && (
            <Box sx={{ mb: 1.5, px: 1.5, py: 1, bgcolor: form['announcement.bgColor'] || brandPrimary, color: form['announcement.fgColor'] || '#fff', borderRadius: 2, fontSize: 12, textAlign: 'center' }}>
              {form['announcement.text'] || 'Free shipping on orders over $50!'}
            </Box>
          )}
          <Box sx={{ ...previewCardSx, p: 1.5, mb: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>{storeName}</Typography>
            <Typography variant="caption" color="text.secondary">
              {stickyHeader ? 'Sticky header enabled' : 'Standard header'} • {showCategoryBar ? 'Category bar visible' : 'Category bar hidden'}
            </Typography>
          </Box>
          {footerEnabled && (
            <Box sx={{ mt: 2, p: 2, bgcolor: form['footer.bgColor'] || surfaceColor, color: form['footer.fgColor'] || textColor, borderRadius: `${borderRadius}px`, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700}>{storeName}</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>{footerTagline}</Typography>
              {footerShowLinks && (
                <Typography variant="caption" sx={{ display: 'block', mt: 1.5 }}>
                  {(links.slice(0, 3).map((link) => link.label).filter(Boolean).join(' • ')) || 'Home • Products • Cart'}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      );
    }

    if (currentTab === 'Homepage') {
      return (
        <Box sx={previewContainerSx}>
          <Box
            sx={{
              p: 2.5,
              borderRadius: `${borderRadius + 4}px`,
              color: primaryHeroSlide.color || heroTextColor,
              background: primaryHeroSlide.image
                ? `linear-gradient(rgba(0,0,0,0.52), rgba(0,0,0,0.52)), url(${primaryHeroSlide.image}) center/cover`
                : `linear-gradient(135deg, ${brandPrimary}, ${brandSecondary})`,
            }}
          >
            {primaryHeroSlide.eyebrow && (
              <Typography variant="caption" fontWeight={800} sx={{ color: 'inherit', opacity: 0.9 }}>
                {primaryHeroSlide.eyebrow}
              </Typography>
            )}
            <Typography variant="h6" fontWeight={800} sx={{ color: 'inherit' }}>{primaryHeroSlide.title || heroTitle}</Typography>
            <Typography variant="body2" sx={{ color: 'inherit', opacity: 0.9, mt: 0.75, mb: 2 }}>{primaryHeroSlide.subtitle || heroSubtitle}</Typography>
            <Box sx={{ display: 'inline-block', px: 1.5, py: 0.9, ...previewButtonSx, fontWeight: 700, fontSize: 13 }}>
              {primaryHeroSlide.buttonText || heroButtonText}
            </Box>
          </Box>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {homepageSections.filter((item) => item.type !== 'hero-carousel' && bool(item.enabled)).slice(0, 7).map((item) => (
              <Box key={item.id}>
                <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
                  {item.title || HOMEPAGE_SECTION_TYPES.find((type) => type.value === item.type)?.label || item.type}
                </Typography>
                <Box sx={{
                  display: item.type === 'value-props' || item.type === 'brand-showcase' ? 'flex' : 'grid',
                  gridTemplateColumns: item.type === 'category-shortcuts' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                  gap: 1,
                }}>
                  {Array.from({ length: item.type === 'value-props' || item.type === 'brand-showcase' ? 4 : item.type === 'category-shortcuts' ? 3 : 2 }).map((_, i) => (
                    <Box key={i} sx={{ height: item.type === 'brand-showcase' ? 22 : item.type === 'category-shortcuts' ? 40 : 58, flex: 1, bgcolor: surfaceColor, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }} />
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      );
    }

    if (currentTab === 'Catalog') {
      return (
        <Box sx={previewContainerSx}>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1.5 }}>Catalog Card Preview</Typography>
          <Box sx={{ p: 1.5, bgcolor: surfaceColor, borderRadius: `${borderRadius}px`, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ height: 120, borderRadius: 2, background: `linear-gradient(135deg, ${brandPrimary}22, ${brandSecondary}33)`, mb: 1.5 }} />
            <Typography variant="body2" fontWeight={700}>Everyday Essential Tee</Typography>
            {showProductSku && (
              <Typography variant="caption" color="text.secondary">SKU: TSHIRT-RED-M</Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5 }}>
              <Typography variant="body2" fontWeight={700}>{formatMoney(49.99)}</Typography>
              {showStockBadge && (
                <Box sx={{ px: 1, py: 0.4, borderRadius: 999, bgcolor: '#2e7d3220', color: '#2e7d32', fontSize: 11, fontWeight: 700 }}>In Stock</Box>
              )}
            </Box>
            <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: showBuyNowButton ? '1fr 1fr' : '1fr', gap: 1 }}>
              <Box sx={{ px: 1.25, py: 0.9, bgcolor: brandPrimary, color: '#fff', borderRadius: 2, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
                {addToCartLabel}
              </Box>
              {showBuyNowButton && (
                <Box sx={{ px: 1.25, py: 0.9, border: '1px solid', borderColor: brandPrimary, color: brandPrimary, borderRadius: 2, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
                  {buyNowLabel}
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      );
    }

    if (currentTab === 'Checkout') {
      const shippingValue = form['shipping.method'] === 'free'
        ? 0
        : Number(form['shipping.flatRate'] || 5);
      const taxRate = Number(form['tax.rate'] || 0);
      const subtotal = 89.99;
      const taxAmount = taxInclusive ? 0 : subtotal * taxRate;
      const total = subtotal + shippingValue + taxAmount;

      return (
        <Box sx={previewContainerSx}>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1.5 }}>Checkout Summary</Typography>
          <Box sx={{ p: 2, bgcolor: surfaceColor, borderRadius: `${borderRadius}px`, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Order #Preview</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}><Typography variant="body2">Subtotal</Typography><Typography variant="body2">{formatMoney(subtotal)}</Typography></Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}><Typography variant="body2">Shipping</Typography><Typography variant="body2">{shippingValue === 0 ? 'Free' : formatMoney(shippingValue)}</Typography></Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}><Typography variant="body2">Tax</Typography><Typography variant="body2">{taxInclusive ? 'Included' : formatMoney(taxAmount)}</Typography></Box>
            <Divider sx={{ my: 1.25 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="subtitle2" fontWeight={800}>Total</Typography><Typography variant="subtitle2" fontWeight={800}>{formatMoney(total)}</Typography></Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            {guestCheckoutEnabled ? 'Guest checkout enabled' : 'Account required'} • {couponsEnabled ? 'Coupons available' : 'Coupons hidden'}
          </Typography>
        </Box>
      );
    }

    if (currentTab === 'Promotions') {
      return (
        <Box sx={previewContainerSx}>
          <Box sx={{ p: 2, bgcolor: surfaceColor, borderRadius: `${borderRadius}px`, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.25 }}>
              {showSaleLabelBadge && (
                <Box sx={{ px: 1, py: 0.4, borderRadius: 999, bgcolor: `${brandSecondary}22`, color: brandSecondary, fontSize: 11, fontWeight: 700 }}>
                  {saleLabel}
                </Box>
              )}
              {showDiscountPercentBadge && (
                <Box sx={{ px: 1, py: 0.4, borderRadius: 999, bgcolor: `${brandPrimary}22`, color: brandPrimary, fontSize: 11, fontWeight: 700 }}>
                  25% OFF
                </Box>
              )}
            </Box>
            <Typography variant="body2" fontWeight={700}>Wireless Headphones</Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 1 }}>
              <Typography variant="h6" fontWeight={800}>{formatMoney(149.99)}</Typography>
              <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>{formatMoney(199.99)}</Typography>
            </Box>
            {showSavingsAmount && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>You save {formatMoney(50)}</Typography>
            )}
            {Boolean(form['sales.showTiming']) || Boolean(form['sales.showSaleTiming']) ? null : null}
            {showSaleTiming && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Ends tomorrow at 11:59 PM</Typography>
            )}
            {showCountdown && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: brandSecondary, fontWeight: 700 }}>Ending soon • 08h 24m left</Typography>
            )}
          </Box>
        </Box>
      );
    }

    return (
      <Box sx={previewContainerSx}>
        <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1.5 }}>Search & Discovery Preview</Typography>
        <Box sx={{ p: 2, bgcolor: surfaceColor, borderRadius: `${borderRadius}px`, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">Search result</Typography>
          <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5 }}>{storeName} | Premium online shopping experience</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{form['seo.defaultDescription'] || 'Shop the best products online at unbeatable prices.'}</Typography>
          <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: brandPrimary }}>
            {form['seo.googleAnalyticsId'] || 'Analytics not connected yet'}
          </Typography>
        </Box>
      </Box>
    );
  };

  const renderHomepageControls = () => (
    <>
      <Alert severity="info" sx={{ mb: 2.5 }}>
        These controls now edit the same configurable homepage schema used by the storefront. Reorder sections, hide blocks, and update slide/banner content here, then click Save All.
      </Alert>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>Hero Slides</Typography>
      {heroSlides.map((slide, index) => (
        <Paper key={`hero-slide-${index}`} variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="body2" fontWeight={700}>Slide {index + 1}</Typography>
            {heroSlides.length > 1 && (
              <IconButton size="small" color="error" onClick={() => removeHeroSlide(index)} aria-label="Remove hero slide">
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Eyebrow" value={slide.eyebrow || ''} onChange={(e) => updateHeroSlide(index, { eyebrow: e.target.value })} sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Text Color" type="color" value={slide.color || '#ffffff'} onChange={(e) => updateHeroSlide(index, { color: e.target.value })} sx={{ mb: 2 }} />
            </Grid>
          </Grid>
          <TextField fullWidth size="small" label="Headline" value={slide.title || ''} onChange={(e) => updateHeroSlide(index, { title: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth size="small" label="Subheading" value={slide.subtitle || ''} onChange={(e) => updateHeroSlide(index, { subtitle: e.target.value })} multiline rows={2} sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Primary Button Label" value={slide.buttonText || ''} onChange={(e) => updateHeroSlide(index, { buttonText: e.target.value })} sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Primary Button Link" value={slide.buttonLink || ''} onChange={(e) => updateHeroSlide(index, { buttonLink: e.target.value })} sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Secondary Button Label" value={slide.secondaryButtonText || ''} onChange={(e) => updateHeroSlide(index, { secondaryButtonText: e.target.value })} sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Secondary Button Link" value={slide.secondaryButtonLink || ''} onChange={(e) => updateHeroSlide(index, { secondaryButtonLink: e.target.value })} sx={{ mb: 2 }} />
            </Grid>
          </Grid>
          <TextField fullWidth size="small" label="Hero Image URL" value={slide.image || ''} onChange={(e) => updateHeroSlide(index, { image: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth size="small" label="Image Position" value={slide.position || 'center'} onChange={(e) => updateHeroSlide(index, { position: e.target.value })} />
        </Paper>
      ))}
      <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addHeroSlide} sx={{ mb: 3 }}>
        Add Hero Slide
      </Button>

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Homepage Sections</Typography>
      {homepageSections.map((item, index) => (
        <Paper key={`${item.id}-${index}`} variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 2 }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField fullWidth size="small" label="Section ID" value={item.id || ''} onChange={(e) => updateHomepageSection(index, { id: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select label="Type" value={item.type || 'product-row'} onChange={(e) => updateHomepageSection(index, { type: e.target.value })}>
                  {HOMEPAGE_SECTION_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControlLabel
                control={<Switch checked={bool(item.enabled)} onChange={(e) => updateHomepageSection(index, { enabled: e.target.checked })} />}
                label="Visible"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 0.5 }}>
                <IconButton size="small" disabled={index === 0} onClick={() => moveHomepageSection(index, -1)} aria-label="Move section up">
                  <ArrowBackIosNewIcon fontSize="small" sx={{ transform: 'rotate(90deg)' }} />
                </IconButton>
                <IconButton size="small" disabled={index === homepageSections.length - 1} onClick={() => moveHomepageSection(index, 1)} aria-label="Move section down">
                  <ArrowForwardIosIcon fontSize="small" sx={{ transform: 'rotate(90deg)' }} />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => removeHomepageSection(index)} aria-label="Remove section">
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            </Grid>
          </Grid>

          {item.type !== 'hero-carousel' && item.type !== 'value-props' && (
            <TextField fullWidth size="small" label="Section Title" value={item.title || ''} onChange={(e) => updateHomepageSection(index, { title: e.target.value })} sx={{ mt: 2 }} />
          )}
          {(item.type === 'category-shortcuts' || item.type === 'promo-banners') && (
            <TextField fullWidth size="small" label="Subtitle" value={item.subtitle || ''} onChange={(e) => updateHomepageSection(index, { subtitle: e.target.value })} sx={{ mt: 2 }} />
          )}
          {(item.type === 'product-row' || item.type === 'category-shortcuts' || item.type === 'brand-showcase') && (
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth size="small" label="Count" type="number" value={item.count ?? 8} onChange={(e) => updateHomepageSection(index, { count: Number(e.target.value) })} sx={{ mt: 2 }} />
              </Grid>
              {item.type === 'product-row' && (
                <>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                      <InputLabel>Product Source</InputLabel>
                      <Select label="Product Source" value={item.source || 'newest'} onChange={(e) => updateHomepageSection(index, { source: e.target.value })}>
                        {HOMEPAGE_PRODUCT_SOURCES.map((source) => (
                          <MenuItem key={source.value} value={source.value}>{source.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                      <InputLabel>Layout</InputLabel>
                      <Select label="Layout" value={item.layout || 'grid'} onChange={(e) => updateHomepageSection(index, { layout: e.target.value })}>
                        <MenuItem value="grid">Grid</MenuItem>
                        <MenuItem value="carousel">Carousel</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" label="View All Label" value={item.viewAllLabel || ''} onChange={(e) => updateHomepageSection(index, { viewAllLabel: e.target.value })} sx={{ mt: 2 }} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" label="View All Link" value={item.viewAllLink || ''} onChange={(e) => updateHomepageSection(index, { viewAllLink: e.target.value })} sx={{ mt: 2 }} />
                  </Grid>
                </>
              )}
            </Grid>
          )}
        </Paper>
      ))}
      <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addHomepageSection} sx={{ mb: 3 }}>
        Add Section
      </Button>

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Value Props</Typography>
      {homepageValueProps.map((item, index) => (
        <Grid container spacing={1.5} key={item.id} sx={{ mb: 1 }}>
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Icon</InputLabel>
              <Select label="Icon" value={item.icon || 'verified'} onChange={(e) => updateValueProp(index, { icon: e.target.value })}>
                {HOMEPAGE_VALUE_ICONS.map((icon) => <MenuItem key={icon} value={icon}>{icon}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth size="small" label="Title" value={item.title || ''} onChange={(e) => updateValueProp(index, { title: e.target.value })} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Text" value={item.text || ''} onChange={(e) => updateValueProp(index, { text: e.target.value })} />
          </Grid>
          <Grid item xs={12} sm={1}>
            <IconButton color="error" onClick={() => removeValueProp(index)} aria-label="Remove value prop">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Grid>
        </Grid>
      ))}
      <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addValueProp} sx={{ mb: 3 }}>
        Add Value Prop
      </Button>

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Promo Banners</Typography>
      {homepagePromos.map((promo, index) => (
        <Paper key={promo.id} variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="body2" fontWeight={700}>Promo {index + 1}</Typography>
            <IconButton size="small" color="error" onClick={() => removeHomepagePromo(index)} aria-label="Remove promo banner">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Kicker" value={promo.kicker || ''} onChange={(e) => updateHomepagePromo(index, { kicker: e.target.value })} sx={{ mb: 2 }} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Background" type="color" value={promo.color || '#ffffff'} onChange={(e) => updateHomepagePromo(index, { color: e.target.value })} sx={{ mb: 2 }} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Accent" type="color" value={promo.accentColor || brandPrimary} onChange={(e) => updateHomepagePromo(index, { accentColor: e.target.value })} sx={{ mb: 2 }} /></Grid>
          </Grid>
          <TextField fullWidth size="small" label="Title" value={promo.title || ''} onChange={(e) => updateHomepagePromo(index, { title: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth size="small" label="Subtitle" value={promo.subtitle || ''} onChange={(e) => updateHomepagePromo(index, { subtitle: e.target.value })} sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="CTA Text" value={promo.ctaText || ''} onChange={(e) => updateHomepagePromo(index, { ctaText: e.target.value })} sx={{ mb: 2 }} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Link" value={promo.link || ''} onChange={(e) => updateHomepagePromo(index, { link: e.target.value })} sx={{ mb: 2 }} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Image URL" value={promo.image || ''} onChange={(e) => updateHomepagePromo(index, { image: e.target.value })} sx={{ mb: 2 }} /></Grid>
          </Grid>
        </Paper>
      ))}
      <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addHomepagePromo}>
        Add Promo Banner
      </Button>
    </>
  );

  const panels = [
    [
      section(
        'Store Identity',
        'Manage your store name, description, and the regional basics customers see across the storefront.',
        <>
          {field('general.storeName', 'Store Name')}
          {field('general.storeDescription', 'Store Description')}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Currency</InputLabel>
            <Select
              label="Currency"
              value={form['general.currency'] || 'USD'}
              onChange={(e) => set('general.currency', e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <MenuItem key={c.code} value={c.code}>
                  {c.symbol}&nbsp;&nbsp;{c.name} ({c.code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {field('general.locale', 'Locale (e.g. en-US, fr-FR)')}
          {field('general.timezone', 'Time Zone (e.g. UTC, Asia/Kolkata)')}
          {field('general.contactEmail', 'Contact Email', 'email')}
        </>,
        ['store', 'general', 'currency', 'locale', 'timezone', 'email']
      ),
      section(
        'Brand Assets',
        'Upload or reference the logos customers see in the header and browser tab.',
        <>
          {imageField('logo.main', 'Main Logo (used in header/navbar)')}
          {imageField('logo.favicon', 'Favicon (16×16 or 32×32 .ico / .png)')}
        </>,
        ['logo', 'favicon', 'brand assets']
      ),
    ],
    [
      section(
        'SEO & Search Engine Control',
        'Configure how your store appears in search results and social media shares globally.',
        <>
          {toggle('features.seo', 'Enable Storefront SEO Features')}
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ opacity: bool(form['features.seo']) ? 1 : 0.5, pointerEvents: bool(form['features.seo']) ? 'auto' : 'none' }}>
            <Alert severity="info" sx={{ mb: 2.5 }}>
              These settings act as the global fallback. Individual products and categories can have their own SEO overrides.
            </Alert>
            {field('seo.titleSuffix', 'Title Suffix (e.g. | My Store Name)', 'text', { helperText: 'Appears after the page name in browser tabs.' })}
            {field('seo.defaultTitle', 'Default Home Title', 'text', { helperText: 'Title for the homepage if no override exists.' })}
            {field('seo.defaultDescription', 'Default Meta Description', 'text', { multiline: true, rows: 3 })}
            {field('seo.defaultKeywords', 'Default Keywords (Internal)', 'text', { helperText: 'Separated by commas. Used for internal search fallback.' })}
            {field('seo.canonicalBaseUrl', 'Canonical Base URL', 'text', { placeholder: 'https://mystore.com', helperText: 'Crucial for automatic canonical URL generation. Include https://' })}
            {field('seo.ogImage', 'Default Social Share Image (URL)')}
            {form['seo.ogImage'] && (
              <Box sx={{ mb: 2 }}>
                <img src={form['seo.ogImage']} alt="OG Preview" style={{ maxHeight: 100, borderRadius: 8, border: '1px solid #ddd' }} />
              </Box>
            )}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Analytics & Tracking</Typography>
            {field('seo.googleAnalyticsId', 'Google Analytics G-ID')}
            {field('seo.facebookPixelId', 'Facebook Pixel ID')}
            
            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="subtitle2">URL-Specific Overrides</Typography>
                <Typography variant="caption" color="text.secondary">
                  Manage custom SEO for static paths like /, /about, or /contact.
                </Typography>
              </Box>
              <Button 
                variant="outlined" 
                size="small" 
                component={Link} 
                to="/admin/seo-overrides"
                startIcon={<PublicIcon fontSize="small" />}
              >
                Manage Overrides
              </Button>
            </Box>
          </Box>
        </>,
        ['seo', 'search', 'google', 'analytics', 'meta', 'canonical', 'toggle']
      ),
    ],
    [
      section(
        'Theme & Colors',
        'Start with a suggested theme, then fine-tune every color and token.',
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Suggested Custom Themes</Typography>
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            {THEME_PRESETS.map((preset) => (
              <Grid item xs={12} md={4} key={preset.name}>
                <Paper
                  variant="outlined"
                  sx={{ p: 1.5, height: '100%', borderRadius: 2, cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}
                  onClick={() => applyThemePreset(preset)}
                >
                  <Box sx={{ display: 'flex', gap: 0.75, mb: 1 }}>
                    <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: preset.values['theme.primaryColor'] }} />
                    <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: preset.values['theme.secondaryColor'] }} />
                    <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: preset.values['theme.backgroundColor'], border: '1px solid', borderColor: 'divider' }} />
                  </Box>
                  <Typography variant="body2" fontWeight={700}>{preset.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{preset.description}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
          <FormControlLabel
            control={
              <Switch
                checked={form['theme.mode'] === 'dark'}
                onChange={(e) => set('theme.mode', e.target.checked ? 'dark' : 'light')}
              />
            }
            label="Dark Mode"
            sx={{ mb: 2, display: 'block' }}
          />
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Brand Colors</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>{field('theme.primaryColor', 'Primary Color', 'color')}</Grid>
            <Grid item xs={12} sm={6}>{field('theme.secondaryColor', 'Secondary Color', 'color')}</Grid>
            <Grid item xs={12} sm={6}>{field('theme.backgroundColor', 'Background Color', 'color')}</Grid>
            <Grid item xs={12} sm={6}>{field('theme.surfaceColor', 'Surface / Card Color', 'color')}</Grid>
            <Grid item xs={12} sm={6}>{field('theme.textColor', 'Text Color', 'color')}</Grid>
          </Grid>
        </>,
        ['theme', 'colors', 'dark mode', 'primary', 'secondary', 'preset']
      ),
      section(
        'Typography, Shape & Components',
        'Control fonts, corner radius, header treatment, buttons, cards, and page background style.',
        <>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                options={FONTS}
                value={form['theme.fontFamily'] || ''}
                onChange={(e, value) => set('theme.fontFamily', value || '')}
                freeSolo
                renderInput={(params) => <TextField {...params} label="Font Family" size="small" sx={{ mb: 2 }} />}
              />
            </Grid>
            <Grid item xs={12} sm={6}>{field('theme.borderRadius', 'Border Radius (e.g. 12px)')}</Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Header Style</InputLabel>
                <Select label="Header Style" value={headerStyle} onChange={(e) => set('theme.headerStyle', e.target.value)}>
                  <MenuItem value="gradient">Gradient</MenuItem>
                  <MenuItem value="solid">Solid</MenuItem>
                  <MenuItem value="glass">Glass</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Button Style</InputLabel>
                <Select label="Button Style" value={buttonStyle} onChange={(e) => set('theme.buttonStyle', e.target.value)}>
                  <MenuItem value="solid">Solid</MenuItem>
                  <MenuItem value="soft">Soft</MenuItem>
                  <MenuItem value="outline">Outline</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Card Style</InputLabel>
                <Select label="Card Style" value={cardStyle} onChange={(e) => set('theme.cardStyle', e.target.value)}>
                  <MenuItem value="elevated">Elevated</MenuItem>
                  <MenuItem value="outlined">Outlined</MenuItem>
                  <MenuItem value="flat">Flat</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Background Style</InputLabel>
                <Select label="Background Style" value={backgroundStyle} onChange={(e) => set('theme.backgroundStyle', e.target.value)}>
                  <MenuItem value="softGradient">Soft Gradient</MenuItem>
                  <MenuItem value="solid">Solid</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </>,
        ['font', 'radius', 'typography', 'shape', 'header', 'button', 'card']
      ),
      section(
        'Announcement Bar',
        'Control the slim message strip shown at the top of every storefront page.',
        <>
          {toggle('announcement.enabled', 'Show announcement bar')}
          {Boolean(form['announcement.enabled']) && (
            <>
              <TextField
                fullWidth size="small" label="Message text"
                value={form['announcement.text'] ?? ''}
                onChange={(e) => set('announcement.text', e.target.value)}
                sx={{ mb: 2, mt: 1 }}
                inputProps={{ maxLength: 200 }}
                helperText={`${String(form['announcement.text'] ?? '').length}/200`}
              />
              {field('announcement.link', 'Link URL — leave empty for no link (e.g. /products)')}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>{field('announcement.bgColor', 'Background Color', 'color')}</Grid>
                <Grid item xs={12} sm={4}>{field('announcement.fgColor', 'Text Color', 'color')}</Grid>
              </Grid>
              {toggle('announcement.dismissible', 'Show dismiss (✕) button')}
            </>
          )}
        </>,
        ['announcement', 'banner', 'top bar']
      ),
    ],
    [
      section(
        'Header & Navigation',
        'Choose how the top navigation behaves and whether category navigation is promoted.',
        <>
          {toggle('nav.sticky', 'Sticky navbar — stays visible while scrolling')}
          {toggle('nav.showCategoryBar', 'Show category bar below the navbar')}
        </>,
        ['header', 'nav', 'navigation', 'sticky']
      ),
      section(
        'Login & Register Pages',
        'Control the shared visual panel and page copy shown on customer authentication screens.',
        <>
          {imageField('auth.image', 'Login/Register Background Image')}
          {field('auth.imagePosition', 'Image Position (e.g. center, left, right, 50% 40%)')}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>{field('auth.headingColor', 'Heading Color', 'color')}</Grid>
            <Grid item xs={12} sm={6}>{field('auth.descriptionColor', 'Description Color', 'color')}</Grid>
          </Grid>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Login Copy</Typography>
          {field('auth.loginHeading', 'Login Heading')}
          <TextField
            fullWidth
            size="small"
            label="Login Description"
            value={form['auth.loginDescription'] ?? ''}
            onChange={(e) => set('auth.loginDescription', e.target.value)}
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />
          {field('auth.loginFormTitle', 'Login Form Title')}
          {field('auth.loginFormSubtitle', 'Login Form Subtitle')}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Register Copy</Typography>
          {field('auth.registerHeading', 'Register Heading')}
          <TextField
            fullWidth
            size="small"
            label="Register Description"
            value={form['auth.registerDescription'] ?? ''}
            onChange={(e) => set('auth.registerDescription', e.target.value)}
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />
          {field('auth.registerFormTitle', 'Register Form Title')}
          {field('auth.registerFormSubtitle', 'Register Form Subtitle')}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Admin Login Copy</Typography>
          {field('auth.adminHeading', 'Admin Login Heading')}
          <TextField
            fullWidth
            size="small"
            label="Admin Login Description"
            value={form['auth.adminDescription'] ?? ''}
            onChange={(e) => set('auth.adminDescription', e.target.value)}
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />
          {field('auth.adminFormTitle', 'Admin Login Form Title')}
          {field('auth.adminFormSubtitle', 'Admin Login Form Subtitle')}
        </>,
        ['login', 'register', 'admin login', 'auth', 'customer account', 'image', 'heading', 'description']
      ),
      section(
        'Footer',
        'Customize footer layout, links, social icons, and contact information in one place.',
        <>
          {toggle('footer.enabled', 'Show footer')}
          <Typography variant="subtitle2" sx={{ mb: 1, mt: 2 }}>Appearance</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>{field('footer.bgColor', 'Background Color', 'color')}</Grid>
            <Grid item xs={12} sm={4}>{field('footer.fgColor', 'Text & Icon Color', 'color')}</Grid>
          </Grid>
          {field('footer.tagline', 'Tagline (shown below store name / logo)')}
          {field('footer.copyright', 'Copyright line — use {year} and {storeName}')}

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Social Links</Typography>
          {toggle('footer.showSocial', 'Show social icons')}
          {Boolean(form['footer.showSocial']) && (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>{field('footer.facebook', 'Facebook URL')}</Grid>
              <Grid item xs={12} sm={6}>{field('footer.instagram', 'Instagram URL')}</Grid>
              <Grid item xs={12} sm={6}>{field('footer.twitter', 'Twitter / X URL')}</Grid>
              <Grid item xs={12} sm={6}>{field('footer.youtube', 'YouTube URL')}</Grid>
              <Grid item xs={12} sm={6}>{field('footer.linkedin', 'LinkedIn URL')}</Grid>
            </Grid>
          )}

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Quick Links</Typography>
          {toggle('footer.showLinks', 'Show quick links column')}
          {field('footer.linksTitle', 'Column heading (e.g. Quick Links)')}
          <Box sx={{ mb: 1 }}>
            {links.map((link, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                <TextField
                  size="small" label="Label"
                  value={link.label || ''}
                  onChange={(e) => { const n = [...links]; n[i] = { ...n[i], label: e.target.value }; setLinks(n); }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small" label="URL (e.g. /about)"
                  value={link.url || ''}
                  onChange={(e) => { const n = [...links]; n[i] = { ...n[i], url: e.target.value }; setLinks(n); }}
                  sx={{ flex: 2 }}
                />
                <IconButton size="small" color="error" onClick={() => setLinks(links.filter((_, j) => j !== i))}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() => setLinks([...links, { label: '', url: '' }])} sx={{ mt: 0.5 }}>
              Add Link
            </Button>
          </Box>

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Contact Details</Typography>
          {toggle('footer.showContact', 'Show contact column')}
          {Boolean(form['footer.showContact']) && (
            <>
              {field('footer.email', 'Email address')}
              {field('footer.phone', 'Phone number')}
              <TextField
                fullWidth size="small" label="Address (supports multiple lines)"
                multiline rows={3}
                value={form['footer.address'] ?? ''}
                onChange={(e) => set('footer.address', e.target.value)}
                sx={{ mb: 2 }}
              />
            </>
          )}
        </>,
        ['footer', 'links', 'social', 'contact']
      ),
    ],
    [
      section(
        'Homepage Builder',
        'Control the redesigned homepage: hero slides, section order, product rows, value props, and promo banners.',
        renderHomepageControls(),
        ['hero', 'homepage banner', 'headline', 'sections', 'promo', 'value props']
      ),
    ],
    [
      section(
        'Catalog Listing',
        'Control sorting, filters, grid density, and category depth in product listing pages.',
        <>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Default Sort Order</InputLabel>
            <Select
              label="Default Sort Order"
              value={form['catalog.defaultSort'] || 'newest'}
              onChange={(e) => set('catalog.defaultSort', e.target.value)}
            >
              <MenuItem value="newest">Newest Arrivals</MenuItem>
              <MenuItem value="price_asc">Price: Low to High</MenuItem>
              <MenuItem value="price_desc">Price: High to Low</MenuItem>
              <MenuItem value="name_asc">Name: A to Z</MenuItem>
            </Select>
          </FormControl>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>{field('catalog.defaultPageSize', 'Products per page (e.g. 12, 20, 40)', 'number')}</Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Grid Columns (desktop)</InputLabel>
                <Select
                  label="Grid Columns (desktop)"
                  value={Number(form['catalog.gridColumns']) || 4}
                  onChange={(e) => set('catalog.gridColumns', e.target.value)}
                >
                  <MenuItem value={2}>2 — Wide cards</MenuItem>
                  <MenuItem value={3}>3 columns</MenuItem>
                  <MenuItem value={4}>4 columns (default)</MenuItem>
                  <MenuItem value={5}>5 — Dense grid</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          {field('catalog.priceRangeMax', 'Max price on filter slider (e.g. 2000)', 'number')}
          {toggle('catalog.showFilters', 'Show filter sidebar on catalog page')}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Category Depth</InputLabel>
            <Select
              label="Category Depth"
              value={Number(form['catalog.categoryDepth']) || 3}
              onChange={(e) => set('catalog.categoryDepth', e.target.value)}
            >
              <MenuItem value={1}>1 — Top-level only</MenuItem>
              <MenuItem value={2}>2 — Top + sub-categories</MenuItem>
              <MenuItem value={3}>3 — Top + sub + sub-sub (default)</MenuItem>
              <MenuItem value={4}>4 levels deep</MenuItem>
              <MenuItem value={5}>5 levels deep</MenuItem>
            </Select>
          </FormControl>
          {toggle('catalog.showCategoryIcon', 'Show category icons in storefront (if uploaded)')}
        </>,
        ['catalog', 'sort', 'filters', 'grid', 'category depth', 'icon']
      ),
      section(
        'Product Page Experience',
        'Choose what customers see on individual product pages and whether engagement features are enabled.',
        <>
          {toggle('productPage.showSKU', 'Show SKU code under product name')}
          {toggle('productPage.showStockBadge', 'Show In Stock / Out of Stock badge')}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
            Product Gallery
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={7}>
              <FormControl fullWidth size="small">
                <InputLabel>Thumbnail alignment</InputLabel>
                <Select
                  label="Thumbnail alignment"
                  value={form['productPage.imageAlignment'] || 'horizontal'}
                  onChange={(e) => set('productPage.imageAlignment', e.target.value)}
                >
                  <MenuItem value="horizontal">Horizontal below main image</MenuItem>
                  <MenuItem value="vertical">Vertical beside main image</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={5}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: form['productPage.imageAlignment'] === 'vertical' ? 'row' : 'column',
                  gap: 1,
                  p: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                  minHeight: 90,
                }}
              >
                {form['productPage.imageAlignment'] === 'vertical' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {[1, 2, 3].map((i) => (
                      <Box key={i} sx={{ width: 22, height: 22, borderRadius: 0.75, bgcolor: i === 1 ? 'primary.main' : 'divider' }} />
                    ))}
                  </Box>
                )}
                <Box sx={{ flex: 1, borderRadius: 1.25, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }} />
                {form['productPage.imageAlignment'] !== 'vertical' && (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {[1, 2, 3].map((i) => (
                      <Box key={i} sx={{ width: 24, height: 24, borderRadius: 0.75, bgcolor: i === 1 ? 'primary.main' : 'divider' }} />
                    ))}
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
          {field('productPage.addToCartLabel', 'Add to Cart button label (e.g. Add to Cart, Buy Now, Add to Bag)')}
          {toggle('productPage.showBuyNowButton', 'Show Buy Now button next to Add to Cart')}
          {field('productPage.buyNowLabel', 'Buy Now button label (e.g. Buy Now, Quick Checkout, Order Now)')}

        </>,
        ['product page', 'wishlist', 'reviews', 'stock badge', 'sku', 'image alignment', 'gallery thumbnails']
      ),
      section(
        'Brands Page',
        'Customize how the /brands storefront page looks and behaves.',
        <>
          {field('brandsPage.heroTitle', 'Page title (e.g. Shop by Brand, Our Partners)', 'text')}
          {field('brandsPage.heroSubtitle', 'Page subtitle', 'text')}
          <Divider sx={{ my: 2 }} />
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Card Layout</InputLabel>
            <Select
              label="Card Layout"
              value={form['brandsPage.cardLayout'] || 'standard'}
              onChange={(e) => set('brandsPage.cardLayout', e.target.value)}
            >
              <MenuItem value="standard">Standard — image top, content below</MenuItem>
              <MenuItem value="overlay">Overlay — full-bleed image with text overlay</MenuItem>
              <MenuItem value="minimal">Minimal — compact logo + name</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Grid Columns (desktop)</InputLabel>
            <Select
              label="Grid Columns (desktop)"
              value={Number(form['brandsPage.gridColumns']) || 4}
              onChange={(e) => set('brandsPage.gridColumns', e.target.value)}
            >
              <MenuItem value={2}>2 — Wide cards</MenuItem>
              <MenuItem value={3}>3 columns</MenuItem>
              <MenuItem value={4}>4 columns (default)</MenuItem>
              <MenuItem value={5}>5 — Dense grid</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Image Aspect Ratio</InputLabel>
            <Select
              label="Image Aspect Ratio"
              value={form['brandsPage.imageAspectRatio'] || 'square'}
              onChange={(e) => set('brandsPage.imageAspectRatio', e.target.value)}
            >
              <MenuItem value="square">Square (1:1)</MenuItem>
              <MenuItem value="landscape">Landscape (16:10)</MenuItem>
              <MenuItem value="portrait">Portrait (3:4)</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Card Style</InputLabel>
            <Select
              label="Card Style"
              value={form['brandsPage.cardStyle'] || 'inherit'}
              onChange={(e) => set('brandsPage.cardStyle', e.target.value)}
            >
              <MenuItem value="inherit">Inherit from theme</MenuItem>
              <MenuItem value="elevated">Elevated</MenuItem>
              <MenuItem value="outlined">Outlined</MenuItem>
              <MenuItem value="flat">Flat</MenuItem>
            </Select>
          </FormControl>
          {field('brandsPage.cardBorderRadius', 'Card border radius (px)', 'number')}
          <Divider sx={{ my: 2 }} />
          {toggle('brandsPage.showDescriptions', 'Show brand descriptions on cards')}
          {toggle('brandsPage.showProductCount', 'Show product count badge on cards')}
          {toggle('brandsPage.showAlphabeticalFilter', 'Show A–Z alphabetical filter bar')}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ color: 'text.secondary' }}>
            Featured Brands
          </Typography>
          {toggle('brandsPage.showFeaturedSection', 'Show featured brands hero section at top')}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Featured Layout</InputLabel>
            <Select
              label="Featured Layout"
              value={form['brandsPage.featuredLayout'] || 'banner'}
              onChange={(e) => set('brandsPage.featuredLayout', e.target.value)}
            >
              <MenuItem value="banner">Banner — large hero cards with overlay</MenuItem>
              <MenuItem value="carousel">Carousel — horizontal scroll cards</MenuItem>
              <MenuItem value="grid">Grid — same cards as main grid</MenuItem>
            </Select>
          </FormControl>
          {field('brandsPage.featuredCount', 'Max featured brands to show', 'number')}
        </>,
        ['brands', 'brands page', 'brand grid', 'card layout', 'hero', 'featured']
      ),
      section(
        'SKU Automation',
        'Set up how product and variant SKUs are auto-generated for the catalog.',
        <>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>{field('sku.prefix', 'Prefix (e.g. SHOP, BRAND)', 'text')}</Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Separator</InputLabel>
                <Select label="Separator" value={form['sku.separator'] ?? '-'} onChange={(e) => set('sku.separator', e.target.value)}>
                  <MenuItem value="-">Hyphen  ( - )</MenuItem>
                  <MenuItem value="_">Underscore  ( _ )</MenuItem>
                  <MenuItem value=".">Dot  ( . )</MenuItem>
                  <MenuItem value="">None</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>Product SKU Options</Typography>
          {toggle('sku.includeProductName', 'Include product name code (first word, max 8 chars)')}
          {toggle('sku.useRandom', 'Append random characters for guaranteed uniqueness')}
          {form['sku.useRandom'] && (
            <TextField size="small" label="Random character length" type="number" value={form['sku.randomLength'] ?? 4} onChange={(e) => set('sku.randomLength', e.target.value)} sx={{ mt: 1, mb: 2, width: 200 }} inputProps={{ min: 2, max: 8 }} />
          )}

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Variant SKU Options</Typography>
          {toggle('sku.includeAttributeName', 'Include attribute name (e.g. Color, Size)')}
          {toggle('sku.includeAttributeValue', 'Include attribute value (e.g. Red, XL)')}
          {toggle('sku.autoUppercase', 'Auto-uppercase everything')}

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Live Preview</Typography>
          {(() => {
            const sep = form['sku.separator'] ?? '-';
            const prefix = (form['sku.prefix'] || '').trim();
            const upper = form['sku.autoUppercase'] !== false;
            const includeProductName = form['sku.includeProductName'] !== false;
            const includeAttributeValue = form['sku.includeAttributeValue'] !== false;
            const apply = (s) => (upper ? s.toUpperCase() : s);
            const parts = [];
            if (prefix) parts.push(apply(prefix));
            if (includeProductName) parts.push(apply('Tshirt'));
            if (form['sku.useRandom']) parts.push('A3X7');
            const baseSku = parts.join(sep) || apply('Tshirt');
            const varParts = [baseSku];
            if (form['sku.includeAttributeName']) varParts.push(apply('Color'));
            if (includeAttributeValue) varParts.push(apply('Red'));
            const variantSku = varParts.join(sep);
            return (
              <Box sx={{ fontFamily: 'monospace', bgcolor: 'action.hover', p: 2, borderRadius: 2 }}>
                <Typography variant="body2">Product SKU: <strong>{baseSku}</strong></Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>Variant SKU: <strong>{variantSku}</strong></Typography>
              </Box>
            );
          })()}
        </>,
        ['sku', 'inventory code', 'automation', 'prefix']
      ),
    ],
    [
      section(
        'Shipping',
        'Set how shipping is calculated at checkout and when customers qualify for free delivery.',
        <>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Shipping Method</InputLabel>
            <Select
              label="Shipping Method"
              value={form['shipping.method'] || 'flat_rate'}
              onChange={(e) => set('shipping.method', e.target.value)}
            >
              <MenuItem value="flat_rate">Flat Rate — charge a fixed fee on every order</MenuItem>
              <MenuItem value="free_above_threshold">Free above threshold — flat rate until a minimum order amount</MenuItem>
              <MenuItem value="free">Always Free — no shipping charge</MenuItem>
            </Select>
          </FormControl>
          {form['shipping.method'] !== 'free' && field('shipping.flatRate', `Flat Rate (${currSymbol})`, 'number', { InputProps: { startAdornment: <InputAdornment position="start">{currSymbol}</InputAdornment> } })}
          {form['shipping.method'] === 'free_above_threshold' && field('shipping.freeThreshold', `Free Shipping Above (${currSymbol})`, 'number', { InputProps: { startAdornment: <InputAdornment position="start">{currSymbol}</InputAdornment> } })}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={600} color="text.secondary" mb={0.5}>Delivery Coverage</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Use comma-separated pincodes. Leave serviceable pincodes empty to allow all pincodes except blocked ones.
          </Typography>
          {field('shipping.serviceablePincodes', 'Serviceable pincodes', 'text', { placeholder: '560001, 600001, 110001' })}
          {field('shipping.blockedPincodes', 'Blocked pincodes', 'text', { placeholder: '194101, 744101' })}
        </>,
        ['shipping', 'free shipping', 'delivery', 'pincode', 'serviceable']
      ),
      section(
        'Taxes',
        'Configure your store-wide tax strategy, including inclusive pricing and GST breakdowns.',
        <>
          <Typography variant="subtitle2" fontWeight={600} color="text.secondary" mb={1.5}>Base Tax</Typography>
          {field('tax.rate', 'Global Tax Rate — used when no GST component is enabled (e.g. 0.18 for 18%)', 'number')}
          {toggle('tax.inclusive', 'Prices include tax (no tax added at checkout)')}

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={600} color="text.secondary" mb={0.5}>GST Breakdown (India)</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            When any GST component is enabled it overrides the global rate and shows a line-by-line breakdown.
          </Typography>

          {toggle('tax.enableCGST', 'Enable CGST (Central Goods & Services Tax)')}
          {enableCGST && field('tax.cgstRate', 'CGST Rate (e.g. 0.09 for 9%)', 'number')}
          {toggle('tax.enableSGST', 'Enable SGST (State Goods & Services Tax)')}
          {enableSGST && field('tax.sgstRate', 'SGST Rate (e.g. 0.09 for 9%)', 'number')}
          {toggle('tax.enableIGST', 'Enable IGST (Integrated GST — inter-state)')}
          {enableIGST && field('tax.igstRate', 'IGST Rate (e.g. 0.18 for 18%)', 'number')}
        </>,
        ['tax', 'gst', 'cgst', 'sgst', 'igst']
      ),
      section(
        'Checkout Experience',
        'Decide how easy checkout is and which customer conveniences are available.',
        <>

        </>,
        ['checkout', 'guest checkout', 'coupons']
      ),
      section(
        'Payment Gateways',
        'Enable, disable and configure payment providers from the dedicated gateway manager.',
        <Box
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            p: 2, border: '1px solid', borderColor: 'primary.main', borderRadius: 2,
            bgcolor: 'primary.main', color: '#fff',
          }}
        >
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#fff' }}>
              💳 Manage Payment Gateways
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', mt: 0.25 }}>
              Configure Razorpay, Cashfree, Stripe, PayU, and Cash on Delivery — including API keys and connection status.
            </Typography>
          </Box>
          <Button
            component="a"
            href="/admin/payment-gateways"
            variant="contained"
            size="small"
            sx={{ bgcolor: '#fff', color: 'primary.main', flexShrink: 0, ml: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}
          >
            Open Gateway Manager →
          </Button>
        </Box>,
        ['payment', 'gateway', 'razorpay', 'stripe', 'payu', 'cashfree', 'cod']
      ),
    ],
    [
      section(
        'Sale Display & Behavior',
        'Control how sale campaigns behave in admin and how they appear across the storefront.',
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Admin Controls</Typography>
          {toggle('sales.allowScheduling', 'Allow admins to schedule sale start/end dates on products')}
          {toggle('sales.allowBulkSales', 'Allow bulk apply / remove sale actions in Manage Products')}

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Storefront Display</Typography>
          {toggle('sales.showDiscountPercent', 'Show discount percentage badges (e.g. 30% OFF)')}
          {toggle('sales.showSavingsAmount', 'Show “You save …” messages on product pages')}
          {toggle('sales.showSaleLabel', 'Show sale labels such as Flash Sale or Summer Deal')}
          {toggle('sales.showSaleTiming', 'Show sale start / end timing text')}
          {toggle('sales.showCountdown', 'Show countdown / relative timing messages')}
          {field('sales.defaultSaleLabel', 'Default sale label when product has no custom label')}
          {field('sales.endingSoonHours', 'Ending soon threshold in hours', 'number', {
            inputProps: { min: 1, max: 168 },
            helperText: 'Used to highlight sales that are about to end.',
          })}
        </>,
        ['sales', 'promotions', 'discount', 'countdown', 'ending soon']
      ),

    ],
    [
      section(
        'Invoice Customization',
        'Configure how your printable customer invoices appear.',
        <>
          {field('invoice.prefix', 'Invoice Number Prefix (e.g. INV-)')}
          {field('invoice.companyName', 'Company Legal Name (Overrides Store Name if provided)')}
          {field('invoice.taxRegistryNumber', 'Tax / VAT Registration Number')}
          
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={600} color="text.secondary" mb={1.5}>Invoice Logo</Typography>
          {toggle('invoice.showLogo', 'Show logo on printed invoices')}
          {form['invoice.showLogo'] !== false && (
            <>
              {imageField('invoice.logoUrl', 'Specific Invoice Logo (Optional, falls back to store logo)')}
            </>
          )}

          <Divider sx={{ my: 2 }} />
          <TextField
            fullWidth size="small" label="Custom Invoice Notes / Terms"
            multiline rows={4}
            value={form['invoice.customNotes'] ?? ''}
            onChange={(e) => set('invoice.customNotes', e.target.value)}
            sx={{ mb: 2 }}
            helperText="Appears at the bottom of the printed invoice."
          />
        </>,
        ['invoice', 'print', 'tax id', 'terms', 'notes', 'legal']
      ),
    ],
    [
      section(
        'API Builder',
        'Control whether admins can create public custom APIs from catalog, content, menu, and setting data.',
        <>
          {toggle('features.apiBuilder', 'Enable API Builder')}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            When disabled, saved custom API URLs stop responding and the admin builder is hidden from the sidebar.
          </Typography>
        </>,
        ['api builder', 'custom api', 'dynamic api', 'public api']
      ),
      section(
        'SEO & Discovery',
        'Set defaults for search engines, social sharing, and analytics snippets.',
        <>
          {field('seo.titleTemplate', 'Page Title Template (use %s for page name, e.g. %s | My Store)')}
          {field('seo.defaultDescription', 'Default Meta Description')}
          {imageField('seo.ogImage', 'Default OG / Social Share Image')}
          {field('seo.googleAnalyticsId', 'Google Analytics ID (e.g. G-XXXXXXXX)')}
        </>,
        ['seo', 'analytics', 'meta description', 'og image']
      ),

      section(
        'Dashboard',
        'Control dashboard layout, density, default date period, and visible widgets.',
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Dashboard Profile</Typography>
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            {Object.entries(DASHBOARD_PROFILES).map(([profileKey, profile]) => {
              const selected = (form['admin.dashboard.profile'] || 'owner') === profileKey;
              return (
                <Grid item xs={12} sm={6} md={3} key={profileKey}>
                  <Paper
                    variant="outlined"
                    onClick={() => applyDashboardProfile(profileKey)}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      cursor: 'pointer',
                      borderColor: selected ? 'primary.main' : 'divider',
                      bgcolor: selected ? 'primary.light' : 'background.paper',
                      color: selected ? 'primary.dark' : 'text.primary',
                      height: '100%',
                    }}
                  >
                    <Typography variant="body2" fontWeight={800}>{profile.label}</Typography>
                    <Typography variant="caption" color={selected ? 'inherit' : 'text.secondary'}>
                      Apply a dashboard preset for this admin workflow.
                    </Typography>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Dashboard Layout</InputLabel>
                <Select
                  label="Dashboard Layout"
                  value={form['admin.dashboard.layout'] || 'balanced'}
                  onChange={(e) => set('admin.dashboard.layout', e.target.value)}
                >
                  <MenuItem value="balanced">Balanced</MenuItem>
                  <MenuItem value="analytics">Analytics Focus</MenuItem>
                  <MenuItem value="compact">Compact Operations</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Dashboard Density</InputLabel>
                <Select
                  label="Dashboard Density"
                  value={form['admin.dashboard.density'] || 'comfortable'}
                  onChange={(e) => set('admin.dashboard.density', e.target.value)}
                >
                  <MenuItem value="compact">Compact</MenuItem>
                  <MenuItem value="comfortable">Comfortable</MenuItem>
                  <MenuItem value="spacious">Spacious</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Default Chart Period</InputLabel>
                <Select
                  label="Default Chart Period"
                  value={form['admin.dashboard.defaultChartPeriod'] || 'monthly'}
                  onChange={(e) => set('admin.dashboard.defaultChartPeriod', e.target.value)}
                >
                  <MenuItem value="daily">Daily (Last 90 days)</MenuItem>
                  <MenuItem value="weekly">Weekly (Last 52 weeks)</MenuItem>
                  <MenuItem value="monthly">Monthly (Last 12 months)</MenuItem>
                  <MenuItem value="quarterly">Quarterly</MenuItem>
                  <MenuItem value="yearly">Yearly (Last 3 years)</MenuItem>
                  <MenuItem value="mtd">Month to Date (MTD)</MenuItem>
                  <MenuItem value="ytd">Year to Date (YTD)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>KPI Cards</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {toggle('admin.dashboard.showStatCards', 'Show quick stat KPI cards')}
            {bool(form['admin.dashboard.showStatCards']) && (
              <Grid container spacing={2} sx={{ pl: { xs: 0, sm: 2 } }}>
                <Grid item xs={12} sm={6}>{toggle('admin.dashboard.showRevenueCard', 'Total Revenue')}</Grid>
                <Grid item xs={12} sm={6}>{toggle('admin.dashboard.showOrdersCard', 'Total Orders')}</Grid>
                <Grid item xs={12} sm={6}>{toggle('admin.dashboard.showCustomersCard', 'Customers')}</Grid>
                <Grid item xs={12} sm={6}>{toggle('admin.dashboard.showProductsCard', 'Published Products')}</Grid>
              </Grid>
            )}
          </Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Main Widgets</Typography>
          <DragDropContext onDragEnd={handleDashboardOrderDragEnd}>
            <Droppable droppableId="dashboard-widget-order">
              {(provided) => (
                <Box
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}
                >
                  {dashboardOrder.map((widgetId, index) => {
                    const widget = DASHBOARD_ORDER_WIDGETS.find((item) => item.id === widgetId);
                    if (!widget) return null;
                    return (
                      <Draggable key={widget.id} draggableId={widget.id} index={index}>
                        {(dragProvided, snapshot) => (
                          <Paper
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.5,
                              bgcolor: snapshot.isDragging ? 'action.hover' : 'background.paper',
                              boxShadow: snapshot.isDragging ? 3 : 'none',
                            }}
                          >
                            <IconButton size="small" {...dragProvided.dragHandleProps} aria-label={`Reorder ${widget.label}`}>
                              <DragIndicatorIcon fontSize="small" />
                            </IconButton>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={700}>{widget.label}</Typography>
                              <Typography variant="caption" color="text.secondary">{widget.description}</Typography>
                            </Box>
                          </Paper>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </Box>
              )}
            </Droppable>
          </DragDropContext>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              {toggle('admin.dashboard.showSalesChart', 'Show sales chart')}
              <FormControl fullWidth size="small" disabled={!bool(form['admin.dashboard.showSalesChart'])}>
                <InputLabel>Sales Chart Size</InputLabel>
                <Select
                  label="Sales Chart Size"
                  value={form['admin.dashboard.salesChartSize'] || 'large'}
                  onChange={(e) => set('admin.dashboard.salesChartSize', e.target.value)}
                >
                  <MenuItem value="large">Large</MenuItem>
                  <MenuItem value="full">Full Width</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              {toggle('admin.dashboard.showRecentOrders', 'Show recent orders')}
              <FormControl fullWidth size="small" disabled={!bool(form['admin.dashboard.showRecentOrders'])}>
                <InputLabel>Recent Orders Size</InputLabel>
                <Select
                  label="Recent Orders Size"
                  value={form['admin.dashboard.recentOrdersSize'] || 'medium'}
                  onChange={(e) => set('admin.dashboard.recentOrdersSize', e.target.value)}
                >
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="large">Large</MenuItem>
                  <MenuItem value="full">Full Width</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              {toggle('admin.dashboard.showOperationsSummary', 'Show operations summary')}
              <FormControl fullWidth size="small" disabled={!bool(form['admin.dashboard.showOperationsSummary'])}>
                <InputLabel>Operations Summary Size</InputLabel>
                <Select
                  label="Operations Summary Size"
                  value={form['admin.dashboard.operationsSummarySize'] || 'medium'}
                  onChange={(e) => set('admin.dashboard.operationsSummarySize', e.target.value)}
                >
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="large">Large</MenuItem>
                  <MenuItem value="full">Full Width</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              {toggle('admin.dashboard.showInventoryWarnings', 'Show inventory warnings')}
              <FormControl fullWidth size="small" disabled={!bool(form['admin.dashboard.showInventoryWarnings'])}>
                <InputLabel>Inventory Warnings Size</InputLabel>
                <Select
                  label="Inventory Warnings Size"
                  value={form['admin.dashboard.inventoryWarningsSize'] || 'medium'}
                  onChange={(e) => set('admin.dashboard.inventoryWarningsSize', e.target.value)}
                >
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="large">Large</MenuItem>
                  <MenuItem value="full">Full Width</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              {toggle('admin.dashboard.showStoreHealth', 'Show store health')}
              <FormControl fullWidth size="small" disabled={!bool(form['admin.dashboard.showStoreHealth'])}>
                <InputLabel>Store Health Size</InputLabel>
                <Select
                  label="Store Health Size"
                  value={form['admin.dashboard.storeHealthSize'] || 'medium'}
                  onChange={(e) => set('admin.dashboard.storeHealthSize', e.target.value)}
                >
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="large">Large</MenuItem>
                  <MenuItem value="full">Full Width</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              {toggle('admin.dashboard.showLowStockAlerts', 'Show low stock alert panel')}
              <FormControl fullWidth size="small" disabled={!bool(form['admin.dashboard.showLowStockAlerts'])}>
                <InputLabel>Low Stock Size</InputLabel>
                <Select
                  label="Low Stock Size"
                  value={form['admin.dashboard.lowStockSize'] || 'full'}
                  onChange={(e) => set('admin.dashboard.lowStockSize', e.target.value)}
                >
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="large">Large</MenuItem>
                  <MenuItem value="full">Full Width</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </>,
        ['dashboard', 'admin', 'chart', 'widgets', 'layout', 'density']
      ),

    ],
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Settings
        </Typography>
        <Button variant="contained" onClick={handleSave} disabled={saving || !canManageSettings}>
          {saving ? 'Saving…' : 'Save All'}
        </Button>
      </Box>

      {!canManageSettings && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You have read-only access to settings. Changes are disabled until you are granted the settings manage permission.
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} xl={8}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, mb: 3, boxShadow: 'none' }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Quick Find
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Search across all settings using plain-language terms like logo, shipping, tax, sale, hero, footer, checkout, or SEO.
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Search settings…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </Paper>

          {/* <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, mb: 3, boxShadow: 'none' }}>
            <Grid container spacing={2.5} alignItems="center">
              <Grid item xs={12} md={5}>
                <Typography variant="subtitle1" fontWeight={800}>
                  Product Gallery Layout
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Choose how thumbnail images appear on product detail pages.
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Thumbnail alignment</InputLabel>
                  <Select
                    label="Thumbnail alignment"
                    value={form['productPage.imageAlignment'] || 'horizontal'}
                    onChange={(e) => set('productPage.imageAlignment', e.target.value)}
                  >
                    <MenuItem value="horizontal">Horizontal below main image</MenuItem>
                    <MenuItem value="vertical">Vertical beside main image</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: form['productPage.imageAlignment'] === 'vertical' ? 'row' : 'column',
                    gap: 0.75,
                    p: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: 'action.hover',
                    height: 82,
                  }}
                >
                  {form['productPage.imageAlignment'] === 'vertical' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {[1, 2, 3].map((i) => (
                        <Box key={i} sx={{ width: 18, height: 18, borderRadius: 0.75, bgcolor: i === 1 ? 'primary.main' : 'divider' }} />
                      ))}
                    </Box>
                  )}
                  <Box sx={{ flex: 1, borderRadius: 1.25, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }} />
                  {form['productPage.imageAlignment'] !== 'vertical' && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {[1, 2, 3].map((i) => (
                        <Box key={i} sx={{ width: 20, height: 20, borderRadius: 0.75, bgcolor: i === 1 ? 'primary.main' : 'divider' }} />
                      ))}
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Paper> */}

          <Paper
            elevation={0}
            sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}
          >
            <Tabs value={safeTabIndex} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
              {visibleTabs.map((t) => (
                <Tab
                  key={t}
                  label={t}
                />
              ))}
            </Tabs>
            <Divider />
            <Box sx={{ p: 3 }}>
              <Box sx={{ pointerEvents: canManageSettings ? 'auto' : 'none', opacity: canManageSettings ? 1 : 0.75 }}>
                {isMessagingTab ? (
                  <Box>
                    <MessagingSettingsPanel form={form} set={set} />
                    <Divider sx={{ my: 4 }} />
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                      <Box>
                        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Email Templates</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Manage transactional email templates — order confirmations, shipping updates, password resets, and more.
                          Templates support Handlebars <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: 4 }}>{'{{variable}}'}</code> syntax and include a live preview.
                        </Typography>
                      </Box>
                      <Button
                        variant="contained"
                        component={Link}
                        to="/admin/email-templates"
                        startIcon={<span style={{ fontSize: 18 }}>✉️</span>}
                        sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        Manage Email Templates
                      </Button>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
                      {[
                        { icon: '🛍️', label: 'Order Placed' },
                        { icon: '📦', label: 'Order Shipped' },
                        { icon: '✅', label: 'Order Delivered' },
                        { icon: '❌', label: 'Order Cancelled' },
                        { icon: '💳', label: 'Order Refunded' },
                        { icon: '👋', label: 'Welcome' },
                        { icon: '✉️', label: 'Email Verification' },
                        { icon: '🔑', label: 'Password Reset' },
                        { icon: '⚠️', label: 'Low Stock Alert' },
                      ].map(({ icon, label }) => (
                        <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                          <Typography fontSize={20}>{icon}</Typography>
                          <Typography variant="body2" fontWeight={500}>{label}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ) : (
                  renderSections(panels[originalIndex])
                )}

              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} xl={4}>
          <Box sx={{ position: { xl: 'sticky' }, top: { xl: 24 } }}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, boxShadow: 'none' }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Live Preview
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                This mock storefront updates instantly as you edit {currentTab.toLowerCase()} settings.
              </Typography>
              {previewPanel()}
            </Paper>
          </Box>
        </Grid>
      </Grid>

      <MediaPicker
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
        multiple={false}
        title="Select Asset"
      />
    </Box>
  );
};

export default SettingsPage;
