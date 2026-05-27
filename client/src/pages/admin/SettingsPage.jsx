import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
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
} from '@mui/material';
import { updateSettings, getEmailTemplates, updateEmailTemplate, sendTestEmail as sendTestEmailApi } from '../../services/adminService';
import { getAllSettings } from '../../services/settingsService';
import { useNotification } from '../../context/NotificationContext';
import { SettingsContext } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { useIsSuperAdmin } from '../../hooks/useAuth';
import { useMode } from '../../hooks/useSettings';
import useHomepageSettings from '../../hooks/useHomepageSettings';
import { PERMISSIONS } from '../../utils/permissions';
import { DASHBOARD_PROFILES } from '../../components/admin/dashboard/dashboardWidgets';
import MessagingSettingsPanel from '../../components/admin/settings/MessagingSettingsPanel';
import SettingsPreviewPanel from '../../components/admin/settings/SettingsPreviewPanel';
import MediaPicker from '../../components/common/MediaPicker';
import buildSettingsPanels from '../../components/admin/settings/buildSettingsPanels';
import { getMediaUrl } from '../../utils/media';
import { DEFAULT_STORE_NAME } from '../../utils/store';
import { INDIAN_STATES } from '../../utils/indianStates';

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
    getAllSettings().then((raw = {}) => {
      const flat = {};
      Object.entries(raw).forEach(([group, keys]) => {
        if (typeof keys === 'object') {
          Object.entries(keys).forEach(([k, v]) => {
            flat[`${group}.${k}`] = v;
          });
        }
      });
      // Normalise tax.originState: clamp any legacy free-text or case variant to the
      // canonical entry in INDIAN_STATES. Unrecognised values are cleared so the
      // strict (non-freeSolo) Autocomplete doesn't silently show an invalid value.
      if (flat['tax.originState']) {
        const raw = String(flat['tax.originState']).trim().toLowerCase();
        const match = INDIAN_STATES.find((s) => s.toLowerCase() === raw);
        flat['tax.originState'] = match || '';
      }

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

  useEffect(() => {
    const bodyFont = form['theme.fontFamily'];
    const headFont = form['theme.headingFont'];
    if (bodyFont || headFont) {
      const fonts = new Set();
      if (bodyFont) fonts.add(bodyFont);
      if (headFont) fonts.add(headFont);
      const families = [...fonts]
        .map((f) => `family=${f.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800;900`)
        .join('&');
      const linkId = 'google-font-preview-link';
      let link = document.getElementById(linkId);
      if (!link) {
        link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    }
  }, [form['theme.fontFamily'], form['theme.headingFont']]);

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
  const storeName = form['general.storeName'] || DEFAULT_STORE_NAME;
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
    fontWeight: form['theme.bodyWeight'] ? parseInt(form['theme.bodyWeight']) : 400,
    lineHeight: form['theme.lineHeight'] || 1.5,
    letterSpacing: form['theme.letterSpacing'] || '0px',
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
  const {
    homepageSections,
    heroSlides,
    homepagePromos,
    homepageValueProps,
    updateHomepageSection,
    moveHomepageSection,
    removeHomepageSection,
    addHomepageSection,
    updateHeroSlide,
    removeHeroSlide,
    addHeroSlide,
    updateHomepagePromo,
    removeHomepagePromo,
    addHomepagePromo,
    updateValueProp,
    removeValueProp,
    addValueProp,
  } = useHomepageSettings({ form, set, brandPrimary });
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





  const panels = buildSettingsPanels({
    form, set, section, field, imageField, toggle, bool,
    currSymbol, links, setLinks,
    headerStyle, buttonStyle, cardStyle, backgroundStyle, brandPrimary,
    dashboardOrder, handleDashboardOrderDragEnd,
    applyThemePreset, applyDashboardProfile,
    THEME_PRESETS, FONTS, CURRENCIES, DASHBOARD_ORDER_WIDGETS, DASHBOARD_PROFILES,
    HOMEPAGE_SECTION_TYPES, HOMEPAGE_PRODUCT_SOURCES, HOMEPAGE_VALUE_ICONS,
    homepageSections, heroSlides, homepagePromos, homepageValueProps,
    updateHomepageSection, moveHomepageSection, removeHomepageSection, addHomepageSection,
    updateHeroSlide, removeHeroSlide, addHeroSlide,
    updateHomepagePromo, removeHomepagePromo, addHomepagePromo,
    updateValueProp, removeValueProp, addValueProp,
    enableCGST, enableSGST, enableIGST,
  });

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
              <SettingsPreviewPanel
                currentTab={currentTab}
                form={form}
                previewStyles={previewStyles}
                themeMode={themeMode}
                textColor={textColor}
                storeName={storeName}
                previewHeaderBackground={previewHeaderBackground}
                headerStyle={headerStyle}
                previewCardSx={previewCardSx}
                storeDescription={storeDescription}
                previewButtonSx={previewButtonSx}
                brandSecondary={brandSecondary}
                announcementEnabled={announcementEnabled}
                brandPrimary={brandPrimary}
                stickyHeader={stickyHeader}
                showCategoryBar={showCategoryBar}
                footerEnabled={footerEnabled}
                surfaceColor={surfaceColor}
                borderRadius={borderRadius}
                footerTagline={footerTagline}
                footerShowLinks={footerShowLinks}
                links={links}
                primaryHeroSlide={primaryHeroSlide}
                heroTextColor={heroTextColor}
                heroTitle={heroTitle}
                heroSubtitle={heroSubtitle}
                heroButtonText={heroButtonText}
                homepageSections={homepageSections}
                homepageSectionTypes={HOMEPAGE_SECTION_TYPES}
                showProductSku={showProductSku}
                showStockBadge={showStockBadge}
                showBuyNowButton={showBuyNowButton}
                addToCartLabel={addToCartLabel}
                buyNowLabel={buyNowLabel}
                formatMoney={formatMoney}
                taxInclusive={taxInclusive}
                guestCheckoutEnabled={guestCheckoutEnabled}
                couponsEnabled={couponsEnabled}
                showSaleLabelBadge={showSaleLabelBadge}
                saleLabel={saleLabel}
                showDiscountPercentBadge={showDiscountPercentBadge}
                showSavingsAmount={showSavingsAmount}
                showSaleTiming={showSaleTiming}
                showCountdown={showCountdown}
              />
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
