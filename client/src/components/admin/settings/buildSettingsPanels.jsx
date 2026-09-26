/**
 * buildSettingsPanels.jsx
 *
 * Extracted tab/section configuration for SettingsPage.
 * Returns the `panels` array — an array-of-arrays where each inner array
 * corresponds to one settings tab and contains section objects.
 *
 * Receives a `ctx` object with all state, helpers, and constants needed
 * to render the inline JSX.
 */
import { Link } from 'react-router-dom';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import {
  Alert,
  Box,
  Typography,
  Paper,
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
  Autocomplete,
  IconButton,
  InputAdornment,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PublicIcon from '@mui/icons-material/Public';
import CssVarsPanel from './CssVarsPanel';
import StoreDesignSummary from './StoreDesignSummary';
import { INDIAN_STATES } from '../../../utils/indianStates';

export default function buildSettingsPanels(ctx) {
  const {
    form, set, section, field, imageField, toggle, bool,
    currSymbol,
    dashboardOrder, handleDashboardOrderDragEnd,
    applyDashboardProfile,
    CURRENCIES, DASHBOARD_ORDER_WIDGETS, DASHBOARD_PROFILES,
    homepageSections,
    enableCGST, enableSGST, enableIGST,
  } = ctx;

  return [
    // ─── 0: Store ───────────────────────────────────────────────────────
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
    // ─── 1: SEO ─────────────────────────────────────────────────────────
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
              <Button variant="outlined" size="small" component={Link} to="/admin/seo-overrides" startIcon={<PublicIcon fontSize="small" />}>
                Manage Overrides
              </Button>
            </Box>
          </Box>
        </>,
        ['seo', 'search', 'google', 'analytics', 'meta', 'canonical', 'toggle']
      ),
    ],
    // ─── 2: Branding ────────────────────────────────────────────────────
    [
      section(
        'Store Design',
        'Manage the visual identity of the storefront from one canonical editor with a live preview.',
        <>
          <StoreDesignSummary scope="global" form={form} homepageSections={homepageSections} />
        </>,
        ['theme', 'colors', 'dark mode', 'primary', 'secondary', 'preset', 'font', 'radius', 'typography', 'shape', 'header', 'button', 'card']
      ),
      section(
        'Storefront Card Styles',
        'Choose and customize reusable product, category, promo, brand, and trust card recipes from the visual editor.',
        <>
          <StoreDesignSummary scope="cards" form={form} homepageSections={homepageSections} />
        </>,
        ['product card', 'category card', 'promo card', 'brand card', 'trust card', 'component styles', 'template card', 'card editor', 'layout']
      ),
      section(
        'Announcement Bar',
        'Edit the slim message strip and its styling from the header inspector.',
        <>
          <StoreDesignSummary scope="announcement" form={form} homepageSections={homepageSections} />
        </>,
        ['announcement', 'banner', 'top bar']
      ),
    ],
    // ─── 3: Layout ──────────────────────────────────────────────────────
    [
      section(
        'Header & Navigation',
        'Edit the visual header layout in Store Designer and manage published links in Menu Builder.',
        <>
          <StoreDesignSummary scope="header" form={form} homepageSections={homepageSections} />
          <Button component={Link} to="/admin/menus" variant="outlined" size="small" sx={{ mt: 2 }}>
            Manage published menu links
          </Button>
        </>,
        ['header', 'nav', 'navigation', 'sticky']
      ),
      section(
        'Footer',
        'Edit footer content and visual layout together from the footer inspector.',
        <>
          <StoreDesignSummary scope="footer" form={form} homepageSections={homepageSections} />
        </>,
        ['footer', 'links', 'social', 'contact']
      ),
    ],
    // ─── 4: Homepage ────────────────────────────────────────────────────
    [
      section(
        'Homepage Builder',
        'Edit homepage sections, blocks, content, and responsive layout from the Home canvas.',
        <>
          <StoreDesignSummary scope="homepage" form={form} homepageSections={homepageSections} />
        </>,
        ['hero', 'homepage banner', 'headline', 'sections', 'promo', 'value props', 'store designer']
      ),
    ],
    // ─── 5: Catalog ─────────────────────────────────────────────────────
    buildCatalogPanel(ctx),
    // ─── 6: Checkout ────────────────────────────────────────────────────
    buildCheckoutPanel(ctx),
    // ─── 7: Promotions ──────────────────────────────────────────────────
    buildPromotionsPanel(ctx),
    // ─── 8: Invoice ─────────────────────────────────────────────────────
    buildInvoicePanel(ctx),
    // ─── 9: Advanced ────────────────────────────────────────────────────
    buildAdvancedPanel(ctx),
  ];
}

function buildCatalogPanel({ form, set, section, field, toggle, imageField }) {
  return [
    section(
      'Catalog Listing',
      'Edit collection layout in Store Designer and keep catalog operations here.',
      <>
        <StoreDesignSummary scope="page" page="collection" form={form} />
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>Catalog Operations</Typography>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Default Sort Order</InputLabel>
          <Select label="Default Sort Order" value={form['catalog.defaultSort'] || 'newest'} onChange={(e) => set('catalog.defaultSort', e.target.value)}>
            <MenuItem value="newest">Newest Arrivals</MenuItem>
            <MenuItem value="price_asc">Price: Low to High</MenuItem>
            <MenuItem value="price_desc">Price: High to Low</MenuItem>
            <MenuItem value="name_asc">Name: A to Z</MenuItem>
          </Select>
        </FormControl>
        {field('catalog.defaultPageSize', 'Products per page (e.g. 12, 20, 40)', 'number')}
        {field('catalog.priceRangeMax', 'Max price on filter slider (e.g. 2000)', 'number')}
        {field('catalog.lowStockThreshold', 'Low stock warning threshold (products with qty ≤ this are flagged)', 'number')}
      </>,
      ['catalog', 'sort', 'filters', 'grid', 'category depth', 'icon', 'low stock', 'threshold']
    ),
    section(
      'Product Page Experience',
      'Edit the product page layout and customer-facing presentation in Store Designer.',
      <>
        <StoreDesignSummary scope="page" page="product" form={form} />
      </>,
      ['product page', 'wishlist', 'reviews', 'stock badge', 'sku', 'image alignment', 'gallery thumbnails']
    ),
    section(
      'Brands Page',
      'Edit the /brands storefront page and card presentation in Store Designer.',
      <>
        <StoreDesignSummary scope="page" page="brand" form={form} />
      </>,
      ['brands', 'brands page', 'brand grid', 'card layout', 'hero', 'featured']
    ),
    section(
      'Category Pages',
      'Edit the /category/:slug storefront page in Store Designer.',
      <>
        <StoreDesignSummary scope="page" page="category" form={form} />
      </>,
      ['category page', 'categories', 'layout']
    ),
    section(
      'Blog & Content Pages',
      'Edit blog list and article presentation in Store Designer.',
      <>
        <StoreDesignSummary scope="page" page="blog" form={form} />
      </>,
      ['blog', 'content', 'article', 'layout']
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
  ];
}

function buildCheckoutPanel({ form, set, section, field, toggle, currSymbol, enableCGST, enableSGST, enableIGST }) {
  return [
    section(
      'Shipping',
      'Set how shipping is calculated at checkout and when customers qualify for free delivery.',
      <>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Shipping Method</InputLabel>
          <Select label="Shipping Method" value={form['shipping.method'] || 'flat_rate'} onChange={(e) => set('shipping.method', e.target.value)}>
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
          When any GST component is enabled it overrides the global rate. CGST+SGST applies for intra-state orders; IGST applies for inter-state orders (based on shipping address vs. store origin state).
        </Typography>
        <Autocomplete
          options={INDIAN_STATES}
          value={form['tax.originState'] || null}
          onChange={(_, v) => set('tax.originState', v || '')}
          size="small"
          sx={{ mb: 2 }}
          renderInput={(params) => <TextField {...params} label="Store Origin State" helperText="Select your business registered state for GST calculation" />}
        />
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
      <></>,
      ['checkout', 'guest checkout', 'coupons']
    ),
    section(
      'Cart Page Experience',
      'Edit cart layout and customer-facing cart content in Store Designer.',
      <>
        <StoreDesignSummary scope="page" page="cart" form={form} />
      </>,
      ['cart', 'layout', 'cross sells', 'empty state']
    ),
    section(
      'Customer Account Experience',
      'Edit the customer account layout and support presentation in Store Designer.',
      <>
        <StoreDesignSummary scope="page" page="account" form={form} />
      </>,
      ['account', 'customer', 'dashboard', 'orders']
    ),
    section(
      'Payment Gateways',
      'Enable, disable and configure payment providers from the dedicated gateway manager.',
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, border: '1px solid', borderColor: 'primary.main', borderRadius: 2, bgcolor: 'primary.main', color: '#fff' }}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#fff' }}>💳 Manage Payment Gateways</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', mt: 0.25 }}>
            Configure Razorpay, Cashfree, Stripe, PayU, and Cash on Delivery — including API keys and connection status.
          </Typography>
        </Box>
        <Button component="a" href="/admin/payment-gateways" variant="contained" size="small" sx={{ bgcolor: '#fff', color: 'primary.main', flexShrink: 0, ml: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
          Open Gateway Manager →
        </Button>
      </Box>,
      ['payment', 'gateway', 'razorpay', 'stripe', 'payu', 'cashfree', 'cod']
    ),
  ];
}

function buildPromotionsPanel({ section, field, toggle }) {
  return [
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
        {toggle('sales.showSavingsAmount', 'Show "You save …" messages on product pages')}
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
  ];
}

function buildInvoicePanel({ form, set, section, field, toggle, imageField }) {
  return [
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
          <>{imageField('invoice.logoUrl', 'Specific Invoice Logo (Optional, falls back to store logo)')}</>
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
  ];
}

function buildAdvancedPanel({ form, set, section, field, toggle, imageField, bool, dashboardOrder, handleDashboardOrderDragEnd, applyDashboardProfile, DASHBOARD_ORDER_WIDGETS, DASHBOARD_PROFILES }) {
  return [
    section(
      'AI Product Assistant',
      'Configure the OpenAI-compatible provider used by the product creation assistant. API keys are encrypted before they are stored and are never sent back in plain text.',
      <>
        <Alert severity="info" sx={{ mb: 2 }}>
          Use Platform Features to show or hide the assistant on product forms. Values saved here override the matching server environment values; blank fields keep the environment fallback.
        </Alert>
        <TextField
          fullWidth
          size="small"
          label="API Key"
          type="password"
          value={form['ai_credentials.apiKey'] ?? ''}
          onChange={(e) => set('ai_credentials.apiKey', e.target.value)}
          onFocus={(e) => e.target.select()}
          autoComplete="new-password"
          sx={{ mb: 2 }}
          helperText={form['ai_credentials.apiKey'] === '********'
            ? 'A key is already stored. Leave this masked value unchanged to keep it, or replace it with a new key.'
            : 'Stored encrypted on the server. Leave blank to use the server environment fallback.'}
        />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            {field('ai.baseUrl', 'Provider Base URL (e.g. https://openrouter.ai/api/v1)', 'text')}
          </Grid>
          <Grid item xs={12} sm={6}>
            {field('ai.model', 'Model (e.g. mistralai/mistral-7b-instruct:free)', 'text')}
          </Grid>
          <Grid item xs={12} sm={6}>
            {field('ai.chatCompletionsPath', 'Chat Completions Path', 'text')}
          </Grid>
          <Grid item xs={12} sm={6}>
            {field('ai.timeoutMs', 'Request Timeout (ms)', 'number', { inputProps: { min: 1000, max: 120000 } })}
          </Grid>
          <Grid item xs={12} sm={6}>
            {field('ai.siteUrl', 'Provider Site URL', 'url')}
          </Grid>
          <Grid item xs={12} sm={6}>
            {field('ai.siteTitle', 'Provider Site Title', 'text')}
          </Grid>
        </Grid>
      </>,
      ['ai', 'assistant', 'openai', 'openrouter', 'api key', 'provider', 'model']
    ),
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
      'Custom Code / Code Injection',
      'Inject custom styles or scripts (e.g. Google Tag Manager, custom trackers, integrations) into the storefront.',
      <>
        <TextField
          fullWidth
          multiline
          rows={6}
          size="small"
          label="Header Scripts"
          placeholder="<!-- Scripts injected in the <head> tag -->&#10;<script>&#10;  console.log('head script');&#10;</script>"
          value={form['advanced.headScripts'] ?? ''}
          onChange={(e) => set('advanced.headScripts', e.target.value)}
          sx={{ mb: 3, fontFamily: 'monospace' }}
          InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
          helperText="HTML scripts, meta tags, or link tags injected inside <head>."
        />
        <TextField
          fullWidth
          multiline
          rows={6}
          size="small"
          label="Body Scripts"
          placeholder="<!-- Scripts injected in the <body> tag -->&#10;<script>&#10;  console.log('body script');&#10;</script>"
          value={form['advanced.bodyScripts'] ?? ''}
          onChange={(e) => set('advanced.bodyScripts', e.target.value)}
          sx={{ mb: 3, fontFamily: 'monospace' }}
          InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
          helperText="HTML or JS snippets injected right before the closing </body> tag."
        />
        <Alert
          severity="info"
          sx={{ mb: 2.5 }}
          action={(
            <Button component={Link} to="/admin/store-designer?component=customCss" size="small" color="inherit">
              Open CSS editor
            </Button>
          )}
        >
          Custom CSS is part of the visual design system and is edited in Store Designer. Scripts and integrations remain here.
        </Alert>
        {/* Live reference of all --store-* CSS custom properties */}
        <CssVarsPanel />
      </>,
      ['custom css', 'css injection', 'scripts', 'code injection', 'head scripts', 'body scripts']
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
                  sx={{ p: 1.5, borderRadius: 2, cursor: 'pointer', borderColor: selected ? 'primary.main' : 'divider', bgcolor: selected ? 'primary.light' : 'background.paper', color: selected ? 'primary.dark' : 'text.primary', height: '100%' }}
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
              <Select label="Dashboard Layout" value={form['admin.dashboard.layout'] || 'balanced'} onChange={(e) => set('admin.dashboard.layout', e.target.value)}>
                <MenuItem value="balanced">Balanced</MenuItem>
                <MenuItem value="analytics">Analytics Focus</MenuItem>
                <MenuItem value="compact">Compact Operations</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Dashboard Density</InputLabel>
              <Select label="Dashboard Density" value={form['admin.dashboard.density'] || 'comfortable'} onChange={(e) => set('admin.dashboard.density', e.target.value)}>
                <MenuItem value="compact">Compact</MenuItem>
                <MenuItem value="comfortable">Comfortable</MenuItem>
                <MenuItem value="spacious">Spacious</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Default Chart Period</InputLabel>
              <Select label="Default Chart Period" value={form['admin.dashboard.defaultChartPeriod'] || 'monthly'} onChange={(e) => set('admin.dashboard.defaultChartPeriod', e.target.value)}>
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
              <Box ref={provided.innerRef} {...provided.droppableProps} sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                {dashboardOrder.map((widgetId, index) => {
                  const widget = DASHBOARD_ORDER_WIDGETS.find((item) => item.id === widgetId);
                  if (!widget) return null;
                  return (
                    <Draggable key={widget.id} draggableId={widget.id} index={index}>
                      {(dragProvided, snapshot) => (
                        <Paper ref={dragProvided.innerRef} {...dragProvided.draggableProps} variant="outlined" sx={{ p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: snapshot.isDragging ? 'action.hover' : 'background.paper', boxShadow: snapshot.isDragging ? 3 : 'none' }}>
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
              <Select label="Sales Chart Size" value={form['admin.dashboard.salesChartSize'] || 'large'} onChange={(e) => set('admin.dashboard.salesChartSize', e.target.value)}>
                <MenuItem value="large">Large</MenuItem>
                <MenuItem value="full">Full Width</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            {toggle('admin.dashboard.showRecentOrders', 'Show recent orders')}
            <FormControl fullWidth size="small" disabled={!bool(form['admin.dashboard.showRecentOrders'])}>
              <InputLabel>Recent Orders Size</InputLabel>
              <Select label="Recent Orders Size" value={form['admin.dashboard.recentOrdersSize'] || 'medium'} onChange={(e) => set('admin.dashboard.recentOrdersSize', e.target.value)}>
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
              <Select label="Operations Summary Size" value={form['admin.dashboard.operationsSummarySize'] || 'medium'} onChange={(e) => set('admin.dashboard.operationsSummarySize', e.target.value)}>
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
              <Select label="Inventory Warnings Size" value={form['admin.dashboard.inventoryWarningsSize'] || 'medium'} onChange={(e) => set('admin.dashboard.inventoryWarningsSize', e.target.value)}>
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
              <Select label="Store Health Size" value={form['admin.dashboard.storeHealthSize'] || 'medium'} onChange={(e) => set('admin.dashboard.storeHealthSize', e.target.value)}>
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
              <Select label="Low Stock Size" value={form['admin.dashboard.lowStockSize'] || 'full'} onChange={(e) => set('admin.dashboard.lowStockSize', e.target.value)}>
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
  ];
}
