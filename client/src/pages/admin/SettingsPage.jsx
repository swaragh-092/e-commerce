import { useState, useEffect, useContext } from 'react';
import {
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
import { updateSettings } from '../../services/adminService';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { SettingsContext } from '../../context/ThemeContext';

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

const SettingsPage = () => {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const notify = useNotification();
  const { refreshSettings } = useContext(SettingsContext) || {};

  useEffect(() => {
    api.get('/settings').then((res) => {
      // Flatten { group: { key: value } } → { 'group.key': value }
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
  }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
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

  const tabs = ['Theme', 'Hero', 'Features', 'Sales', 'Shipping', 'Tax', 'SEO', 'General', 'SKU', 'Logo', 'Footer', 'Announcement', 'Nav', 'Catalog', 'Homepage', 'Product Page'];

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

  const panels = [
    /* Theme */
    <Box key="theme">
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
        <Grid item xs={12} sm={6}>
          {field('theme.primaryColor', 'Primary Color', 'color')}
        </Grid>
        <Grid item xs={12} sm={6}>
          {field('theme.secondaryColor', 'Secondary Color', 'color')}
        </Grid>
      </Grid>
      <Typography variant="subtitle2" sx={{ mb: 1, mt: 1 }}>Background Colors</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          {field('theme.backgroundColor', 'Background Color', 'color')}
        </Grid>
        <Grid item xs={12} sm={6}>
          {field('theme.surfaceColor', 'Surface / Card Color', 'color')}
        </Grid>
        <Grid item xs={12} sm={6}>
          {field('theme.textColor', 'Text Color', 'color')}
        </Grid>
      </Grid>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Typography &amp; Shape</Typography>
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
        <Grid item xs={12} sm={6}>
          {field('theme.borderRadius', 'Border Radius (e.g. 12px)')}
        </Grid>
      </Grid>
    </Box>,

    /* Hero */
    <Box key="hero">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Customize the hero banner on the storefront home page.
      </Typography>
      <Divider sx={{ mb: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Content</Typography>
      {field('hero.title', 'Headline')}
      {field('hero.subtitle', 'Subheading')}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          {field('hero.buttonText', 'Button Label')}
        </Grid>
        <Grid item xs={12} sm={6}>
          {field('hero.buttonLink', 'Button Link (e.g. /products)')}
        </Grid>
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
          <Slider
            min={0} max={1} step={0.05}
            value={Number(form['hero.overlayOpacity'] ?? 0.5)}
            onChange={(_, v) => set('hero.overlayOpacity', v)}
            sx={{ mb: 2 }}
          />
        </>
      )}
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Text</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          {field('hero.color', 'Text Color', 'color')}
        </Grid>
      </Grid>
    </Box>,

    /* Features */
    <Box key="features" sx={{ display: 'flex', flexDirection: 'column' }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Store Features</Typography>
      {toggle('features.wishlist', 'Wishlist')}
      {toggle('features.reviews', 'Reviews')}
      {toggle('features.coupons', 'Coupons')}
      {toggle('features.showAvailableCoupons', 'Show available coupons to customers at checkout')}
      {toggle('features.guestCheckout', 'Guest Checkout (no account required)')}
      <Divider sx={{ my: 1.5 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Accounts &amp; Auth</Typography>
      {toggle('features.emailVerification', 'Require email verification on signup')}
      {toggle('features.requirePurchaseForReview', 'Require purchase to leave a review')}
      <Divider sx={{ my: 1.5 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Advanced (coming soon)</Typography>
      {toggle('features.multiCurrency', 'Multi-currency support')}
      {toggle('features.socialLogin', 'Social login (Google / GitHub)')}
    </Box>,

    /* Sales */
    <Box key="sales">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Global controls for how sale campaigns behave and appear across admin and storefront.
      </Typography>
      <Divider sx={{ mb: 3 }} />

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
    </Box>,

    /* Shipping */
    <Box key="shipping">
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
      {form['shipping.method'] !== 'free' && (
        field('shipping.flatRate', `Flat Rate (${currSymbol})`, 'number', {
          InputProps: { startAdornment: <InputAdornment position="start">{currSymbol}</InputAdornment> },
        })
      )}
      {form['shipping.method'] === 'free_above_threshold' && (
        field('shipping.freeThreshold', `Free Shipping Above (${currSymbol})`, 'number', {
          InputProps: { startAdornment: <InputAdornment position="start">{currSymbol}</InputAdornment> },
        })
      )}
    </Box>,

    /* Tax */
    <Box key="tax">
      <Typography variant="subtitle2" fontWeight={600} color="text.secondary" mb={1.5}>Base Tax</Typography>
      {field('tax.rate', 'Global Tax Rate — used when no GST component is enabled (e.g. 0.18 for 18%)', 'number')}
      {toggle('tax.inclusive', 'Prices include tax (no tax added at checkout)')}

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" fontWeight={600} color="text.secondary" mb={0.5}>GST Breakdown (India)</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        When any GST component is enabled it overrides the global rate and shows a line-by-line breakdown.
      </Typography>

      {toggle('tax.enableCGST', 'Enable CGST (Central Goods & Services Tax)')}
      {Boolean(form['tax.enableCGST']) && field('tax.cgstRate', 'CGST Rate (e.g. 0.09 for 9%)', 'number')}

      {toggle('tax.enableSGST', 'Enable SGST (State Goods & Services Tax)')}
      {Boolean(form['tax.enableSGST']) && field('tax.sgstRate', 'SGST Rate (e.g. 0.09 for 9%)', 'number')}

      {toggle('tax.enableIGST', 'Enable IGST (Integrated GST — inter-state)')}
      {Boolean(form['tax.enableIGST']) && field('tax.igstRate', 'IGST Rate (e.g. 0.18 for 18%)', 'number')}
    </Box>,

    /* SEO */
    <Box key="seo">
      {field('seo.titleTemplate', 'Page Title Template (use %s for page name, e.g. %s | My Store)')}
      {field('seo.defaultDescription', 'Default Meta Description')}
      {field('seo.ogImage', 'Default OG / Social Share Image URL')}
      {field('seo.googleAnalyticsId', 'Google Analytics ID (e.g. G-XXXXXXXX)')}
    </Box>,

    /* General */
    <Box key="general">
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
    </Box>,

    /* SKU */
    <Box key="sku">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Controls how SKUs are auto-generated for products and variants. Use the ⚡ button in product and variant forms to generate SKUs based on these rules.
      </Typography>
      <Divider sx={{ mb: 3 }} />
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          {field('sku.prefix', 'Prefix (e.g. SHOP, BRAND)', 'text')}
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Separator</InputLabel>
            <Select
              label="Separator"
              value={form['sku.separator'] ?? '-'}
              onChange={(e) => set('sku.separator', e.target.value)}
            >
              <MenuItem value="-">Hyphen  ( - )</MenuItem>
              <MenuItem value="_">Underscore  ( _ )</MenuItem>
              <MenuItem value=".">Dot  ( . )</MenuItem>
              <MenuItem value="">None</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>Product SKU options</Typography>
      {toggle('sku.includeProductName', 'Include product name code (first word, max 8 chars)')}
      {toggle('sku.useRandom', 'Append random characters for guaranteed uniqueness')}
      {form['sku.useRandom'] && (
        <TextField
          size="small"
          label="Random character length"
          type="number"
          value={form['sku.randomLength'] ?? 4}
          onChange={(e) => set('sku.randomLength', e.target.value)}
          sx={{ mt: 1, mb: 2, width: 200 }}
          inputProps={{ min: 2, max: 8 }}
        />
      )}

      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Variant SKU options</Typography>
      {toggle('sku.includeAttributeName', 'Include attribute name (e.g. Color, Size)')}
      {toggle('sku.includeAttributeValue', 'Include attribute value (e.g. Red, XL)')}
      {toggle('sku.autoUppercase', 'Auto-uppercase everything')}

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Live Preview</Typography>
      {(() => {
        const sep = form['sku.separator'] ?? '-';
        const prefix = (form['sku.prefix'] || '').trim();
        const upper = form['sku.autoUppercase'] !== false;
        const apply = (s) => (upper ? s.toUpperCase() : s);
        const parts = [];
        if (prefix) parts.push(apply(prefix));
        if (form['sku.includeProductName'] !== false) parts.push(apply('Tshirt'));
        if (form['sku.useRandom']) parts.push('A3X7');
        const baseSku = parts.join(sep) || apply('Tshirt');
        const varParts = [baseSku];
        if (form['sku.includeAttributeName']) varParts.push(apply('Color'));
        if (form['sku.includeAttributeValue'] !== false) varParts.push(apply('Red'));
        const variantSku = varParts.join(sep);
        return (
          <Box sx={{ fontFamily: 'monospace', bgcolor: 'action.hover', p: 2, borderRadius: 2 }}>
            <Typography variant="body2">Product SKU: <strong>{baseSku}</strong></Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>Variant SKU: <strong>{variantSku}</strong></Typography>
          </Box>
        );
      })()}
    </Box>,

    /* Logo */
    <Box key="logo">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Paths to logo and favicon assets. These should be URLs or paths relative to the public folder (e.g. <code>/assets/logo.png</code>).
      </Typography>
      <Divider sx={{ mb: 3 }} />
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
    </Box>,

    /* Footer */
    <Box key="footer">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Customize the storefront footer: appearance, social links, navigation and contact info.
      </Typography>
      <Divider sx={{ mb: 3 }} />

      {toggle('footer.enabled', 'Show footer')}

      <Typography variant="subtitle2" sx={{ mb: 1, mt: 2 }}>Appearance</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          {field('footer.bgColor', 'Background Color', 'color')}
        </Grid>
        <Grid item xs={12} sm={4}>
          {field('footer.fgColor', 'Text &amp; Icon Color', 'color')}
        </Grid>
      </Grid>
      {field('footer.tagline', 'Tagline (shown below store name / logo)')}
      {field('footer.copyright', 'Copyright line — use {year} and {storeName}')}

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Social Links</Typography>
      {toggle('footer.showSocial', 'Show social icons')}
      {Boolean(form['footer.showSocial']) && (
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} sm={6}>{field('footer.facebook',  'Facebook URL')}</Grid>
          <Grid item xs={12} sm={6}>{field('footer.instagram', 'Instagram URL')}</Grid>
          <Grid item xs={12} sm={6}>{field('footer.twitter',   'Twitter / X URL')}</Grid>
          <Grid item xs={12} sm={6}>{field('footer.youtube',   'YouTube URL')}</Grid>
          <Grid item xs={12} sm={6}>{field('footer.linkedin',  'LinkedIn URL')}</Grid>
        </Grid>
      )}

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Quick Links Column</Typography>
      {toggle('footer.showLinks', 'Show quick links column')}
      {field('footer.linksTitle', 'Column heading (e.g. Quick Links)')}
      {(() => {
        const links = Array.isArray(form['footer.links']) ? form['footer.links'] : [];
        const setLinks = (v) => set('footer.links', v);
        return (
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
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setLinks([...links, { label: '', url: '' }])}
              sx={{ mt: 0.5 }}
            >
              Add Link
            </Button>
          </Box>
        );
      })()}

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Contact Column</Typography>
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
    </Box>,

    /* Announcement */
    <Box key="announcement">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        A slim banner shown at the very top of every storefront page. Supports a dismiss button and an optional link.
      </Typography>
      <Divider sx={{ mb: 3 }} />
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
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Colours</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              {field('announcement.bgColor', 'Background Color', 'color')}
            </Grid>
            <Grid item xs={12} sm={4}>
              {field('announcement.fgColor', 'Text Color', 'color')}
            </Grid>
          </Grid>
          {toggle('announcement.dismissible', 'Show dismiss (✕) button')}
        </>
      )}
    </Box>,

    /* Nav */
    <Box key="nav">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Controls the top navigation bar behaviour.
      </Typography>
      <Divider sx={{ mb: 3 }} />
      {toggle('nav.sticky', 'Sticky navbar — stays visible while scrolling')}
      {toggle('nav.showCategoryBar', 'Show category bar below the navbar')}
    </Box>,

    /* Catalog */
    <Box key="catalog">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Controls the product listing / catalog page defaults.
      </Typography>
      <Divider sx={{ mb: 3 }} />
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
        <Grid item xs={12} sm={6}>
          {field('catalog.defaultPageSize', 'Products per page (e.g. 12, 20, 40)', 'number')}
        </Grid>
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
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Category Tree Depth</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        How many levels of sub-categories to show in the filter sidebar and category nav bar.<br />
        1 = top-level only &nbsp;|&nbsp; 2 = top + sub &nbsp;|&nbsp; 3 = top + sub + sub-sub (default)
      </Typography>
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
    </Box>,

    /* Homepage */
    <Box key="homepage">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Controls the sections displayed on the storefront home page (below the hero banner).
      </Typography>
      <Divider sx={{ mb: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Category Section</Typography>
      {toggle('homepage.showCategories', 'Show categories section')}
      {field('homepage.categoriesTitle', 'Section heading (e.g. Shop by Category)')}
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>New Arrivals Section</Typography>
      {toggle('homepage.showNewArrivals', 'Show new arrivals / featured products section')}
      {field('homepage.newArrivalsTitle', 'Section heading (e.g. New Arrivals)')}
      {field('homepage.newArrivalsCount', 'Number of products to display (e.g. 8)', 'number')}
    </Box>,

    /* Product Page */
    <Box key="productPage">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Controls what is shown on individual product detail pages.
      </Typography>
      <Divider sx={{ mb: 3 }} />
      {toggle('productPage.showSKU', 'Show SKU code under product name')}
      {toggle('productPage.showStockBadge', 'Show In Stock / Out of Stock badge')}
      {field('productPage.addToCartLabel', 'Add to Cart button label (e.g. Add to Cart, Buy Now, Add to Bag)')}
    </Box>,
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Settings
        </Typography>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save All'}
        </Button>
      </Box>

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
        <Box sx={{ p: 3 }}>{panels[tab]}</Box>
      </Paper>
    </Box>
  );
};

export default SettingsPage;
