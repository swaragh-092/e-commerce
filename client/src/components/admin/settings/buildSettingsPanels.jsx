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
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PublicIcon from '@mui/icons-material/Public';
import HomepageSettingsEditor from './HomepageSettingsEditor';
import { INDIAN_STATES } from '../../../utils/indianStates';

export default function buildSettingsPanels(ctx) {
  const {
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
        'Theme & Colors',
        'Start with a suggested theme, then fine-tune every color and token.',
        <>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                const themeKeys = Object.entries(form).filter(([k]) => k.startsWith('theme.'));
                const themeData = Object.fromEntries(themeKeys);
                const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'theme-export.json';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export Theme
            </Button>
            <Button
              size="small"
              variant="outlined"
              component="label"
            >
              Import Theme
              <input
                type="file"
                accept=".json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const data = JSON.parse(ev.target.result);
                      const themeEntries = Object.entries(data).filter(([k]) => k.startsWith('theme.'));
                      if (themeEntries.length === 0) return;
                      themeEntries.forEach(([k, v]) => set(k, v));
                    } catch { /* ignore invalid JSON */ }
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
              />
            </Button>
          </Box>
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
            control={<Switch checked={form['theme.mode'] === 'dark'} onChange={(e) => set('theme.mode', e.target.checked ? 'dark' : 'light')} />}
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
                value={form['theme.headingFont'] || form['theme.fontFamily'] || ''}
                onChange={(e, value) => set('theme.headingFont', value || '')}
                freeSolo
                renderInput={(params) => <TextField {...params} label="Heading Font" size="small" sx={{ mb: 2 }} />}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                options={FONTS}
                value={form['theme.fontFamily'] || ''}
                onChange={(e, value) => set('theme.fontFamily', value || '')}
                freeSolo
                renderInput={(params) => <TextField {...params} label="Body Font" size="small" sx={{ mb: 2 }} />}
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
    // ─── 3: Layout ──────────────────────────────────────────────────────
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
    // ─── 4: Homepage ────────────────────────────────────────────────────
    [
      section(
        'Homepage Builder',
        'Control the redesigned homepage: hero slides, section order, product rows, value props, and promo banners.',
        <HomepageSettingsEditor
          heroSlides={heroSlides}
          removeHeroSlide={removeHeroSlide}
          updateHeroSlide={updateHeroSlide}
          addHeroSlide={addHeroSlide}
          homepageSections={homepageSections}
          updateHomepageSection={updateHomepageSection}
          sectionTypes={HOMEPAGE_SECTION_TYPES}
          moveHomepageSection={moveHomepageSection}
          removeHomepageSection={removeHomepageSection}
          productSources={HOMEPAGE_PRODUCT_SOURCES}
          addHomepageSection={addHomepageSection}
          homepageValueProps={homepageValueProps}
          valueIcons={HOMEPAGE_VALUE_ICONS}
          updateValueProp={updateValueProp}
          removeValueProp={removeValueProp}
          addValueProp={addValueProp}
          homepagePromos={homepagePromos}
          removeHomepagePromo={removeHomepagePromo}
          updateHomepagePromo={updateHomepagePromo}
          addHomepagePromo={addHomepagePromo}
          brandPrimary={brandPrimary}
        />,
        ['hero', 'homepage banner', 'headline', 'sections', 'promo', 'value props']
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
      'Control sorting, filters, grid density, and category depth in product listing pages.',
      <>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Default Sort Order</InputLabel>
          <Select label="Default Sort Order" value={form['catalog.defaultSort'] || 'newest'} onChange={(e) => set('catalog.defaultSort', e.target.value)}>
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
              <Select label="Grid Columns (desktop)" value={Number(form['catalog.gridColumns']) || 4} onChange={(e) => set('catalog.gridColumns', e.target.value)}>
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
          <Select label="Category Depth" value={Number(form['catalog.categoryDepth']) || 3} onChange={(e) => set('catalog.categoryDepth', e.target.value)}>
            <MenuItem value={1}>1 — Top-level only</MenuItem>
            <MenuItem value={2}>2 — Top + sub-categories</MenuItem>
            <MenuItem value={3}>3 — Top + sub + sub-sub (default)</MenuItem>
            <MenuItem value={4}>4 levels deep</MenuItem>
            <MenuItem value={5}>5 levels deep</MenuItem>
          </Select>
        </FormControl>
        {toggle('catalog.showCategoryIcon', 'Show category icons in storefront (if uploaded)')}
        {field('catalog.lowStockThreshold', 'Low stock warning threshold (products with qty ≤ this are flagged)', 'number')}
      </>,
      ['catalog', 'sort', 'filters', 'grid', 'category depth', 'icon', 'low stock', 'threshold']
    ),
    section(
      'Product Page Experience',
      'Choose what customers see on individual product pages and whether engagement features are enabled.',
      <>
        {toggle('productPage.showSKU', 'Show SKU code under product name')}
        {toggle('productPage.showStockBadge', 'Show In Stock / Out of Stock badge')}
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>Product Gallery</Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={7}>
            <FormControl fullWidth size="small">
              <InputLabel>Thumbnail alignment</InputLabel>
              <Select label="Thumbnail alignment" value={form['productPage.imageAlignment'] || 'horizontal'} onChange={(e) => set('productPage.imageAlignment', e.target.value)}>
                <MenuItem value="horizontal">Horizontal below main image</MenuItem>
                <MenuItem value="vertical">Vertical beside main image</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={5}>
            <Box sx={{ display: 'flex', flexDirection: form['productPage.imageAlignment'] === 'vertical' ? 'row' : 'column', gap: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover', minHeight: 90 }}>
              {form['productPage.imageAlignment'] === 'vertical' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {[1, 2, 3].map((i) => (<Box key={i} sx={{ width: 22, height: 22, borderRadius: 0.75, bgcolor: i === 1 ? 'primary.main' : 'divider' }} />))}
                </Box>
              )}
              <Box sx={{ flex: 1, borderRadius: 1.25, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }} />
              {form['productPage.imageAlignment'] !== 'vertical' && (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {[1, 2, 3].map((i) => (<Box key={i} sx={{ width: 24, height: 24, borderRadius: 0.75, bgcolor: i === 1 ? 'primary.main' : 'divider' }} />))}
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
          <Select label="Card Layout" value={form['brandsPage.cardLayout'] || 'standard'} onChange={(e) => set('brandsPage.cardLayout', e.target.value)}>
            <MenuItem value="standard">Standard — image top, content below</MenuItem>
            <MenuItem value="overlay">Overlay — full-bleed image with text overlay</MenuItem>
            <MenuItem value="minimal">Minimal — compact logo + name</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Grid Columns (desktop)</InputLabel>
          <Select label="Grid Columns (desktop)" value={Number(form['brandsPage.gridColumns']) || 4} onChange={(e) => set('brandsPage.gridColumns', e.target.value)}>
            <MenuItem value={2}>2 — Wide cards</MenuItem>
            <MenuItem value={3}>3 columns</MenuItem>
            <MenuItem value={4}>4 columns (default)</MenuItem>
            <MenuItem value={5}>5 — Dense grid</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Image Aspect Ratio</InputLabel>
          <Select label="Image Aspect Ratio" value={form['brandsPage.imageAspectRatio'] || 'square'} onChange={(e) => set('brandsPage.imageAspectRatio', e.target.value)}>
            <MenuItem value="square">Square (1:1)</MenuItem>
            <MenuItem value="landscape">Landscape (16:10)</MenuItem>
            <MenuItem value="portrait">Portrait (3:4)</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Card Style</InputLabel>
          <Select label="Card Style" value={form['brandsPage.cardStyle'] || 'inherit'} onChange={(e) => set('brandsPage.cardStyle', e.target.value)}>
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
        <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ color: 'text.secondary' }}>Featured Brands</Typography>
        {toggle('brandsPage.showFeaturedSection', 'Show featured brands hero section at top')}
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Featured Layout</InputLabel>
          <Select label="Featured Layout" value={form['brandsPage.featuredLayout'] || 'banner'} onChange={(e) => set('brandsPage.featuredLayout', e.target.value)}>
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
      'Custom CSS',
      'Inject custom CSS into the storefront. Styles are applied globally after the theme.',
      <>
        <TextField
          fullWidth
          multiline
          rows={8}
          size="small"
          label="Custom CSS"
          placeholder={`.my-class {\n  color: red;\n}`}
          value={form['advanced.customCSS'] ?? ''}
          onChange={(e) => set('advanced.customCSS', e.target.value)}
          sx={{ mb: 1, fontFamily: 'monospace' }}
          InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
        />
        <Typography variant="caption" color="text.secondary">
          Use standard CSS selectors. Changes apply immediately after saving.
        </Typography>
      </>,
      ['custom css', 'css injection', 'styles', 'code']
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
