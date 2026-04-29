import { useState, useEffect, useContext } from 'react';
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
  Slider,
  Button,
  Divider,
  Grid,
  InputAdornment,
  Autocomplete,
  IconButton,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { updateSettings, getEmailTemplates, updateEmailTemplate, sendTestEmail as sendTestEmailApi } from '../../services/adminService';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { SettingsContext } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { DASHBOARD_PROFILES } from '../../components/admin/dashboard/dashboardWidgets';
import MessagingSettingsPanel from '../../components/admin/settings/MessagingSettingsPanel';

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
  const [templateExpanded, setTemplateExpanded] = useState(null);
  const { notify } = useNotification();
  const { refreshSettings } = useContext(SettingsContext) || {};
  const { hasPermission } = useAuth();
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
      setForm(flat);
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
      });
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

  const tabs = ['Store', 'Branding', 'Layout', 'Homepage', 'Catalog', 'Checkout', 'Promotions', 'Invoice', 'Advanced', 'Notifications'];
  const currentTab = tabs[tab];
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
  const homepageShowCategories = Boolean(form['homepage.showCategories']);
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
              color: heroTextColor,
              background: form['hero.backgroundType'] === 'image' && form['hero.backgroundImage']
                ? `linear-gradient(rgba(0,0,0,${Number(form['hero.overlayOpacity'] ?? 0.5)}), rgba(0,0,0,${Number(form['hero.overlayOpacity'] ?? 0.5)})), url(${form['hero.backgroundImage']}) center/cover`
                : `linear-gradient(135deg, ${brandPrimary}, ${brandSecondary})`,
            }}
          >
            <Typography variant="h6" fontWeight={800} sx={{ color: heroTextColor }}>{heroTitle}</Typography>
            <Typography variant="body2" sx={{ color: heroTextColor, opacity: 0.9, mt: 0.75, mb: 2 }}>{heroSubtitle}</Typography>
            <Box sx={{ display: 'inline-block', px: 1.5, py: 0.9, ...previewButtonSx, fontWeight: 700, fontSize: 13 }}>
              {heroButtonText}
            </Box>
          </Box>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {homepageShowCategories && (
              <Box>
                <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>{form['homepage.categoriesTitle'] || 'Categories'}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                  {[1, 2, 3].map((i) => (
                    <Box key={i} sx={{ height: 40, bgcolor: surfaceColor, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }} />
                  ))}
                </Box>
              </Box>
            )}

            {bool(form['homepage.showNewArrivals']) && (
              <Box>
                <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>{form['homepage.newArrivalsTitle'] || 'New Arrivals'}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                  {[1, 2].map((i) => (
                    <Box key={i} sx={{ height: 60, bgcolor: surfaceColor, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }} />
                  ))}
                </Box>
              </Box>
            )}

            {bool(form['homepage.showFeatured']) && (
              <Box>
                <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>{form['homepage.featuredTitle'] || 'Featured'}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                  {[1, 2].map((i) => (
                    <Box key={i} sx={{ height: 60, bgcolor: surfaceColor, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }} />
                  ))}
                </Box>
              </Box>
            )}

            {bool(form['homepage.showBestSellers']) && (
              <Box>
                <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>{form['homepage.bestSellersTitle'] || 'Best Sellers'}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                  {[1, 2].map((i) => (
                    <Box key={i} sx={{ height: 60, bgcolor: surfaceColor, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }} />
                  ))}
                </Box>
              </Box>
            )}

            {bool(form['homepage.showOnSale']) && (
              <Box>
                <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>{form['homepage.onSaleTitle'] || 'On Sale'}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                  {[1, 2].map((i) => (
                    <Box key={i} sx={{ height: 60, bgcolor: surfaceColor, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }} />
                  ))}
                </Box>
              </Box>
            )}

            {bool(form['homepage.showBrands']) && (
              <Box>
                <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>{form['homepage.brandsTitle'] || 'Brands'}</Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <Box key={i} sx={{ height: 20, width: 40, bgcolor: surfaceColor, borderRadius: 1, border: '1px solid', borderColor: 'divider' }} />
                  ))}
                </Box>
              </Box>
            )}
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
          {field('logo.main', 'Main Logo URL (used in header/navbar)')}
          {form['logo.main'] && (
            <Box sx={{ mb: 2 }}>
              <img src={form['logo.main']} alt="Logo preview" style={{ maxHeight: 60, objectFit: 'contain', border: '1px solid #ddd', borderRadius: 8, padding: 4 }} onError={(e) => { e.target.style.display = 'none'; }} />
            </Box>
          )}
          {field('logo.favicon', 'Favicon URL (16×16 or 32×32 .ico / .png)')}
          {form['logo.favicon'] && (
            <Box sx={{ mb: 2 }}>
              <img src={form['logo.favicon']} alt="Favicon preview" style={{ maxHeight: 32, objectFit: 'contain', border: '1px solid #ddd', borderRadius: 4, padding: 2 }} onError={(e) => { e.target.style.display = 'none'; }} />
            </Box>
          )}
        </>,
        ['logo', 'favicon', 'brand assets']
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
        'Hero Banner',
        'Control the main landing banner content, button, and visual presentation.',
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Content</Typography>
          {field('hero.title', 'Headline')}
          {field('hero.subtitle', 'Subheading')}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>{field('hero.buttonText', 'Button Label')}</Grid>
            <Grid item xs={12} sm={6}>{field('hero.buttonLink', 'Button Link (e.g. /products)')}</Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Background</Typography>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Background Type</InputLabel>
            <Select
              label="Background Type"
              value={form['hero.backgroundType'] || 'gradient'}
              onChange={(e) => set('hero.backgroundType', e.target.value)}
            >
              <MenuItem value="gradient">Gradient — uses your brand colors</MenuItem>
              <MenuItem value="image">Custom Image</MenuItem>
            </Select>
          </FormControl>
          {(form['hero.backgroundType'] || 'gradient') === 'image' && (
            <>
              {field('hero.backgroundImage', 'Image URL (paste a URL or /uploads/… path)')}
              {form['hero.backgroundImage'] && (
                <Box sx={{ mb: 2, borderRadius: 2, overflow: 'hidden', maxHeight: 160, border: '1px solid', borderColor: 'divider' }}>
                  <img
                    src={form['hero.backgroundImage']}
                    alt="Hero preview"
                    style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </Box>
              )}
              <Typography variant="subtitle2" sx={{ mb: 0.5, mt: 1 }}>
                Dark Overlay: {Math.round(Number(form['hero.overlayOpacity'] ?? 0.5) * 100)}%
              </Typography>
              <Slider min={0} max={1} step={0.05} value={Number(form['hero.overlayOpacity'] ?? 0.5)} onChange={(_, v) => set('hero.overlayOpacity', v)} sx={{ mb: 2 }} />
            </>
          )}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>{field('hero.color', 'Text Color', 'color')}</Grid>
          </Grid>
        </>,
        ['hero', 'homepage banner', 'headline']
      ),
      section(
        'Homepage Sections',
        'Control every content block that appears below the hero banner. All sections are fully customizable.',
        <>
          {/* ── Shop by Category ── */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Shop by Category</Typography>
          {toggle('homepage.showCategories', 'Show categories section')}
          {field('homepage.categoriesTitle', 'Section heading (e.g. Shop by Category)')}
          {field('homepage.categoriesCount', 'Max categories to show (e.g. 12)', 'number')}

          <Divider sx={{ my: 2 }} />

          {/* ── New Arrivals ── */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>New Arrivals</Typography>
          {toggle('homepage.showNewArrivals', 'Show new arrivals section')}
          {field('homepage.newArrivalsTitle', 'Section heading (e.g. New Arrivals)')}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              {field('homepage.newArrivalsCount', 'Number of products to show', 'number')}
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Layout</InputLabel>
                <Select
                  label="Layout"
                  value={form['homepage.newArrivalsLayout'] || 'grid'}
                  onChange={(e) => set('homepage.newArrivalsLayout', e.target.value)}
                >
                  <MenuItem value="grid">Grid (Rows)</MenuItem>
                  <MenuItem value="carousel">Carousel (Horizontal Scroll)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          {field('homepage.newArrivalsLink', '"View All" link (e.g. /products?sort=newest)')}

          <Divider sx={{ my: 2 }} />

          {/* ── Featured Products ── */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Featured Products</Typography>
          {toggle('homepage.showFeatured', 'Show featured products section')}
          {field('homepage.featuredTitle', 'Section heading (e.g. Featured Products)')}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              {field('homepage.featuredCount', 'Number of products to show', 'number')}
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Layout</InputLabel>
                <Select
                  label="Layout"
                  value={form['homepage.featuredLayout'] || 'carousel'}
                  onChange={(e) => set('homepage.featuredLayout', e.target.value)}
                >
                  <MenuItem value="grid">Grid (Rows)</MenuItem>
                  <MenuItem value="carousel">Carousel (Horizontal Scroll)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          {field('homepage.featuredLink', '"View All" link (e.g. /products?featured=true)')}

          <Divider sx={{ my: 2 }} />

          {/* ── Best Sellers ── */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Best Sellers</Typography>
          {toggle('homepage.showBestSellers', 'Show best sellers section')}
          {field('homepage.bestSellersTitle', 'Section heading (e.g. Best Sellers)')}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              {field('homepage.bestSellersCount', 'Number of products to show', 'number')}
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Layout</InputLabel>
                <Select
                  label="Layout"
                  value={form['homepage.bestSellersLayout'] || 'grid'}
                  onChange={(e) => set('homepage.bestSellersLayout', e.target.value)}
                >
                  <MenuItem value="grid">Grid (Rows)</MenuItem>
                  <MenuItem value="carousel">Carousel (Horizontal Scroll)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          {field('homepage.bestSellersLink', '"View All" link (e.g. /products?sort=best-selling)')}

          <Divider sx={{ my: 2 }} />

          {/* ── On Sale ── */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>On Sale</Typography>
          {toggle('homepage.showOnSale', 'Show on-sale products section')}
          {field('homepage.onSaleTitle', 'Section heading (e.g. On Sale)')}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              {field('homepage.onSaleCount', 'Number of products to show', 'number')}
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Layout</InputLabel>
                <Select
                  label="Layout"
                  value={form['homepage.onSaleLayout'] || 'carousel'}
                  onChange={(e) => set('homepage.onSaleLayout', e.target.value)}
                >
                  <MenuItem value="grid">Grid (Rows)</MenuItem>
                  <MenuItem value="carousel">Carousel (Horizontal Scroll)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          {field('homepage.onSaleLink', '"View All" link (e.g. /products?onSale=true)')}

          <Divider sx={{ my: 2 }} />

          {/* ── Shop by Brand ── */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Shop by Brand</Typography>
          {toggle('homepage.showBrands', 'Show brands strip')}
          {field('homepage.brandsTitle', 'Section heading (e.g. Shop by Brand)')}
          {field('homepage.brandsCount', 'Max brands to show (e.g. 12)', 'number')}
        </>,
        ['homepage', 'new arrivals', 'categories', 'featured', 'best sellers', 'on sale', 'brands', 'sections']
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
        </>,
        ['catalog', 'sort', 'filters', 'grid', 'category depth']
      ),
      section(
        'Product Page Experience',
        'Choose what customers see on individual product pages and whether engagement features are enabled.',
        <>
          {toggle('productPage.showSKU', 'Show SKU code under product name')}
          {toggle('productPage.showStockBadge', 'Show In Stock / Out of Stock badge')}
          {field('productPage.addToCartLabel', 'Add to Cart button label (e.g. Add to Cart, Buy Now, Add to Bag)')}
          {toggle('productPage.showBuyNowButton', 'Show Buy Now button next to Add to Cart')}
          {field('productPage.buyNowLabel', 'Buy Now button label (e.g. Buy Now, Quick Checkout, Order Now)')}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Customer Engagement</Typography>
          {toggle('features.wishlist', 'Enable wishlist')}
          {toggle('features.reviews', 'Enable reviews')}
          {toggle('features.requirePurchaseForReview', 'Require purchase to leave a review')}
        </>,
        ['product page', 'wishlist', 'reviews', 'stock badge', 'sku']
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
          {toggle('features.guestCheckout', 'Guest checkout (no account required)')}
          {toggle('features.coupons', 'Enable coupon codes')}
          {toggle('features.showAvailableCoupons', 'Show available coupons to customers at checkout')}
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
      section(
        'Coupon Marketing',
        'Choose whether customers can use and discover coupon campaigns during checkout.',
        <>
          {toggle('features.coupons', 'Enable coupon codes store-wide')}
          {toggle('features.showAvailableCoupons', 'Show available coupons to customers at checkout')}
        </>,
        ['coupon', 'promotions', 'marketing']
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
              {field('invoice.logoUrl', 'Specific Invoice Logo URL (Optional, falls back to store logo)')}
              {form['invoice.logoUrl'] && (
                <Box sx={{ mb: 2 }}>
                  <img src={form['invoice.logoUrl']} alt="Invoice logo preview" style={{ maxHeight: 60, objectFit: 'contain', border: '1px solid #ddd', borderRadius: 8, padding: 4 }} />
                </Box>
              )}
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
        'SEO & Discovery',
        'Set defaults for search engines, social sharing, and analytics snippets.',
        <>
          {field('seo.titleTemplate', 'Page Title Template (use %s for page name, e.g. %s | My Store)')}
          {field('seo.defaultDescription', 'Default Meta Description')}
          {field('seo.ogImage', 'Default OG / Social Share Image URL')}
          {field('seo.googleAnalyticsId', 'Google Analytics ID (e.g. G-XXXXXXXX)')}
        </>,
        ['seo', 'analytics', 'meta description', 'og image']
      ),
      section(
        'Accounts & Authentication',
        'Tighten customer account rules and decide which login experiences are enabled.',
        <>
          {toggle('features.emailVerification', 'Require email verification on signup')}
          {toggle('features.socialLogin', 'Social login (Google / GitHub)')}
        </>,
        ['auth', 'email verification', 'social login', 'accounts']
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
      section(
        'Experimental Features',
        'Keep lower-priority or upcoming capabilities here so the main settings stay focused.',
        <>
          {toggle('features.multiCurrency', 'Multi-currency support')}
        </>,
        ['advanced', 'multi currency', 'experimental']
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

          <Paper
            elevation={0}
            sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}
          >
            <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
              {tabs.map((t) => (
                <Tab key={t} label={t} />
              ))}
            </Tabs>
            <Divider />
            <Box sx={{ p: 3 }}>
              <Box sx={{ pointerEvents: canManageSettings ? 'auto' : 'none', opacity: canManageSettings ? 1 : 0.75 }}>
                {isMessagingTab ? (
                  <Box>
                    <MessagingSettingsPanel form={form} set={set} />
                    <Divider sx={{ my: 4 }} />
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Message Templates</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Customize the transactional emails your store sends. Use <code style={{ background: '#f4f4f4', padding: '1px 4px', borderRadius: 3 }}>{'{{variable}}'}</code> syntax for dynamic content. Changes apply immediately — no restart needed.
                    </Typography>
                    <Box sx={{ mb: 2.5, display: 'flex', gap: 1, alignItems: 'center' }}>
                      <TextField
                        size="small"
                        label="Test email address"
                        placeholder="you@example.com"
                        value={templateTestEmail}
                        onChange={(e) => setTemplateTestEmail(e.target.value)}
                        sx={{ minWidth: 260 }}
                        helperText="Enter an email to send test messages to"
                      />
                    </Box>
                    {emailTemplates.length === 0 && (
                      <Alert severity="info" sx={{ mb: 2 }}>No email templates found. Run the notification templates seeder to populate defaults.</Alert>
                    )}
                    {emailTemplates.map((tpl) => (
                      <Paper key={tpl.name} variant="outlined" sx={{ mb: 2, borderRadius: 2, overflow: 'hidden' }}>
                        <Box
                          sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                          onClick={() => setTemplateExpanded(templateExpanded === tpl.name ? null : tpl.name)}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: tpl.isActive ? 'success.main' : 'text.disabled', flexShrink: 0 }} />
                            <Box>
                              <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>{tpl.name}</Typography>
                              <Typography variant="caption" color="text.secondary">{tpl.subject}</Typography>
                            </Box>
                          </Box>
                          <Typography variant="caption" color="primary">{templateExpanded === tpl.name ? 'Collapse ▲' : 'Edit ▼'}</Typography>
                        </Box>

                        {templateExpanded === tpl.name && (
                          <Box sx={{ p: 2.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  size="small"
                                  checked={tpl.isActive}
                                  onChange={(e) => setEmailTemplates((prev) => prev.map((t) => t.name === tpl.name ? { ...t, isActive: e.target.checked } : t))}
                                />
                              }
                              label="Active — send this email"
                            />
                            <TextField
                              fullWidth size="small" label="Subject line"
                              helperText="Supports {{variables}}"
                              value={tpl.subject}
                              onChange={(e) => setEmailTemplates((prev) => prev.map((t) => t.name === tpl.name ? { ...t, subject: e.target.value } : t))}
                            />
                            <TextField
                              fullWidth size="small" label="HTML Body"
                              multiline rows={12}
                              value={tpl.bodyHtml}
                              onChange={(e) => setEmailTemplates((prev) => prev.map((t) => t.name === tpl.name ? { ...t, bodyHtml: e.target.value } : t))}
                              inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
                              helperText="Full HTML email body. Use {{name}}, {{verify_url}}, {{reset_url}}, etc."
                            />
                            <TextField
                              fullWidth size="small" label="Plain Text Body (fallback)"
                              multiline rows={4}
                              value={tpl.bodyText || ''}
                              onChange={(e) => setEmailTemplates((prev) => prev.map((t) => t.name === tpl.name ? { ...t, bodyText: e.target.value } : t))}
                              inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
                            />
                            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', pt: 0.5 }}>
                              <Button
                                variant="contained" size="small"
                                disabled={templateSaving[tpl.name]}
                                onClick={async () => {
                                  setTemplateSaving((p) => ({ ...p, [tpl.name]: true }));
                                  try {
                                    await updateEmailTemplate(tpl.name, { subject: tpl.subject, bodyHtml: tpl.bodyHtml, bodyText: tpl.bodyText, isActive: tpl.isActive });
                                    notify('Template saved!', 'success');
                                  } catch {
                                    notify('Failed to save template.', 'error');
                                  } finally {
                                    setTemplateSaving((p) => ({ ...p, [tpl.name]: false }));
                                  }
                                }}
                              >
                                {templateSaving[tpl.name] ? 'Saving…' : 'Save Template'}
                              </Button>
                              <Button
                                variant="outlined" size="small"
                                disabled={!templateTestEmail || templateTesting[tpl.name]}
                                onClick={async () => {
                                  setTemplateTesting((p) => ({ ...p, [tpl.name]: true }));
                                  try {
                                    await sendTestEmailApi(tpl.name, templateTestEmail);
                                    notify(`Test email sent to ${templateTestEmail}`, 'success');
                                  } catch {
                                    notify('Failed to send test email. Check your SMTP config.', 'error');
                                  } finally {
                                    setTemplateTesting((p) => ({ ...p, [tpl.name]: false }));
                                  }
                                }}
                              >
                                {templateTesting[tpl.name] ? 'Sending…' : 'Send Test Email'}
                              </Button>
                            </Box>
                          </Box>
                        )}
                      </Paper>
                    ))}
                  </Box>
                ) : (
                  renderSections(panels[tab])
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
    </Box>
  );
};

export default SettingsPage;
