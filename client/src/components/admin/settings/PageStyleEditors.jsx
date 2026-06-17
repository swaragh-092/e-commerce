import React from 'react';
import { Box, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, TextField, Typography, Stack, Grid } from '@mui/material';

const SelectField = ({ label, value, onChange, children }) => (
  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
    <InputLabel>{label}</InputLabel>
    <Select label={label} value={value || ''} onChange={(event) => onChange(event.target.value)}>
      {children}
    </Select>
  </FormControl>
);

const ToggleField = ({ label, checked, onChange }) => (
  <FormControlLabel
    control={<Switch size="small" checked={checked !== false} onChange={(event) => onChange(event.target.checked)} />}
    label={label}
    sx={{ mb: 1, display: 'block' }}
  />
);

const num = (value, fallback = 8) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

// ─── PRODUCT DETAIL PAGE EDITOR ──────────────────────────────────────────────
export const ProductPageStyleEditor = ({ value = {}, onChange }) => {
  const update = (key, val) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>
        Page Layout & Options
      </Typography>
      
      <SelectField
        label="Product Layout"
        value={value.templateLayout || 'media-left-details-right'}
        onChange={(val) => update('templateLayout', val)}
      >
        <MenuItem value="media-left-details-right">Media left, details right</MenuItem>
        <MenuItem value="gallery-top-details-below">Gallery top, details below</MenuItem>
        <MenuItem value="sticky-purchase-panel">Sticky purchase panel</MenuItem>
        <MenuItem value="luxury-editorial">Luxury editorial</MenuItem>
        <MenuItem value="editorial">Editorial</MenuItem>
      </SelectField>

      <SelectField
        label="Thumbnail Alignment"
        value={value.imageAlignment || 'horizontal'}
        onChange={(val) => update('imageAlignment', val)}
      >
        <MenuItem value="horizontal">Horizontal below main image</MenuItem>
        <MenuItem value="vertical">Vertical beside main image</MenuItem>
      </SelectField>

      <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 2, mb: 1.5 }}>
        Visibility Toggles
      </Typography>

      <Grid container spacing={1}>
        <Grid item xs={12} sm={6}>
          <ToggleField
            label="Show breadcrumbs"
            checked={value.showBreadcrumbs}
            onChange={(val) => update('showBreadcrumbs', val)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <ToggleField
            label="Show SKU code"
            checked={value.showSKU}
            onChange={(val) => update('showSKU', val)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <ToggleField
            label="Show stock badge"
            checked={value.showStockBadge}
            onChange={(val) => update('showStockBadge', val)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <ToggleField
            label="Show sticky bar"
            checked={value.showStickyAddToCart}
            onChange={(val) => update('showStickyAddToCart', val)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <ToggleField
            label="Show trust badges"
            checked={value.showTrustBadges}
            onChange={(val) => update('showTrustBadges', val)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <ToggleField
            label="Show related items"
            checked={value.showRelatedProducts}
            onChange={(val) => update('showRelatedProducts', val)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <ToggleField
            label="Show recently viewed"
            checked={value.showRecentlyViewed}
            onChange={(val) => update('showRecentlyViewed', val)}
          />
        </Grid>
      </Grid>

      <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 2, mb: 1.5 }}>
        Labels & Content
      </Typography>

      <TextField
        label="Add to Cart Button Label"
        value={value.addToCartLabel || 'Add to Cart'}
        onChange={(e) => update('addToCartLabel', e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />

      <ToggleField
        label="Show Buy Now Button"
        checked={value.showBuyNowButton}
        onChange={(val) => update('showBuyNowButton', val)}
      />

      {value.showBuyNowButton !== false && (
        <TextField
          label="Buy Now Button Label"
          value={value.buyNowLabel || 'Buy Now'}
          onChange={(e) => update('buyNowLabel', e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
        />
      )}
    </Box>
  );
};

// ─── CATEGORY DETAIL PAGE EDITOR ─────────────────────────────────────────────
export const CategoryPageStyleEditor = ({ value = {}, onChange }) => {
  const update = (key, val) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>
        Page Header Style
      </Typography>

      <TextField
        label="Default Page/Hero Title"
        value={value.heroTitle || 'Shop Category'}
        onChange={(e) => update('heroTitle', e.target.value)}
        helperText="Fallback title if the category lacks a custom name"
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />

      <SelectField
        label="Header Layout"
        value={value.headerLayout || 'standard'}
        onChange={(val) => update('headerLayout', val)}
      >
        <MenuItem value="standard">Standard - title and description inline</MenuItem>
        <MenuItem value="cover">Cover - full-width background banner</MenuItem>
        <MenuItem value="split">Split - text left, image right</MenuItem>
      </SelectField>

      <ToggleField
        label="Show subcategory navigation chips"
        checked={value.showSubcategories}
        onChange={(val) => update('showSubcategories', val)}
      />
    </Box>
  );
};

// ─── CATALOG / COLLECTION PAGE EDITOR ────────────────────────────────────────
export const CatalogPageStyleEditor = ({ value = {}, onChange }) => {
  const update = (key, val) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>
        Catalog & Filter Sidebar
      </Typography>

      <SelectField
        label="Default Sort Order"
        value={value.defaultSort || 'recommended'}
        onChange={(val) => update('defaultSort', val)}
      >
        <MenuItem value="recommended">Recommended</MenuItem>
        <MenuItem value="newest">Newest Arrivals</MenuItem>
        <MenuItem value="price_asc">Price: Low to High</MenuItem>
        <MenuItem value="price_desc">Price: High to Low</MenuItem>
        <MenuItem value="name_asc">Name: A to Z</MenuItem>
      </SelectField>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <SelectField
            label="Grid Columns"
            value={num(value.gridColumns, 4)}
            onChange={(val) => update('gridColumns', Number(val))}
          >
            <MenuItem value={2}>2 - Wide cards</MenuItem>
            <MenuItem value={3}>3 columns</MenuItem>
            <MenuItem value={4}>4 columns</MenuItem>
            <MenuItem value={5}>5 - Dense grid</MenuItem>
          </SelectField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Products Per Page"
            value={value.defaultPageSize || 12}
            onChange={(e) => update('defaultPageSize', Number(e.target.value) || 12)}
            type="number"
            fullWidth
            size="small"
            sx={{ mb: 2 }}
          />
        </Grid>
      </Grid>

      <TextField
        label="Filter Max Price ($)"
        value={value.priceRangeMax || 2000}
        onChange={(e) => update('priceRangeMax', Number(e.target.value) || 2000)}
        type="number"
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />

      <ToggleField
        label="Show filter sidebar on catalog page"
        checked={value.showFilters}
        onChange={(val) => update('showFilters', val)}
      />

      {value.showFilters !== false && (
        <SelectField
          label="Category Filter Depth"
          value={num(value.categoryDepth, 3)}
          onChange={(val) => update('categoryDepth', Number(val))}
        >
          <MenuItem value={1}>1 - Top-level only</MenuItem>
          <MenuItem value={2}>2 - Top + sub-categories</MenuItem>
          <MenuItem value={3}>3 - Top + sub + sub-sub</MenuItem>
          <MenuItem value={4}>4 levels deep</MenuItem>
          <MenuItem value={5}>5 levels deep</MenuItem>
        </SelectField>
      )}

      <ToggleField
        label="Show category icons in filter lists"
        checked={value.showCategoryIcon}
        onChange={(val) => update('showCategoryIcon', val)}
      />

      <TextField
        label="Low Stock Alert Threshold"
        value={value.lowStockThreshold || 10}
        onChange={(e) => update('lowStockThreshold', Number(e.target.value) || 10)}
        type="number"
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        helperText="Products with quantity below this will show a low stock notice"
      />
    </Box>
  );
};

// ─── BLOG PAGE EDITOR ────────────────────────────────────────────────────────
export const BlogPageStyleEditor = ({ value = {}, onChange }) => {
  const update = (key, val) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>
        Blog Layout
      </Typography>

      <SelectField
        label="Blog List Layout"
        value={value.listLayout || 'grid'}
        onChange={(val) => update('listLayout', val)}
      >
        <MenuItem value="grid">Grid Layout</MenuItem>
        <MenuItem value="list">List Layout</MenuItem>
      </SelectField>

      <TextField
        label="Articles Per Page"
        value={value.pageSize || 6}
        onChange={(e) => update('pageSize', Number(e.target.value) || 6)}
        type="number"
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />

      <TextField
        label="Sidebar Recent Posts Count"
        value={value.recentCount || 5}
        onChange={(e) => update('recentCount', Number(e.target.value) || 5)}
        type="number"
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />

      <ToggleField
        label="Show article author"
        checked={value.showAuthor}
        onChange={(val) => update('showAuthor', val)}
      />

      <ToggleField
        label="Show article publish date"
        checked={value.showDate}
        onChange={(val) => update('showDate', val)}
      />
    </Box>
  );
};


// ─── BRANDS PAGE EDITOR ─────────────────────────────────────────────────────
export const BrandsPageStyleEditor = ({ value = {}, onChange }) => {
  const update = (key, val) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>
        Brand Directory
      </Typography>

      <TextField
        label="Page Title"
        value={value.heroTitle || 'Shop by Brand'}
        onChange={(e) => update('heroTitle', e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />

      <TextField
        label="Page Subtitle"
        value={value.heroSubtitle || 'Discover products grouped by your favorite brands.'}
        onChange={(e) => update('heroSubtitle', e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />

      <SelectField
        label="Card Layout"
        value={value.cardLayout || 'standard'}
        onChange={(val) => update('cardLayout', val)}
      >
        <MenuItem value="standard">Standard - image top, content below</MenuItem>
        <MenuItem value="overlay">Overlay - full image with text overlay</MenuItem>
        <MenuItem value="minimal">Minimal - compact logo and name</MenuItem>
      </SelectField>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <SelectField
            label="Grid Columns"
            value={num(value.gridColumns, 4)}
            onChange={(val) => update('gridColumns', Number(val))}
          >
            <MenuItem value={2}>2 - Wide cards</MenuItem>
            <MenuItem value={3}>3 columns</MenuItem>
            <MenuItem value={4}>4 columns</MenuItem>
            <MenuItem value={5}>5 - Dense grid</MenuItem>
          </SelectField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <SelectField
            label="Image Ratio"
            value={value.imageAspectRatio || 'square'}
            onChange={(val) => update('imageAspectRatio', val)}
          >
            <MenuItem value="square">Square</MenuItem>
            <MenuItem value="landscape">Landscape</MenuItem>
            <MenuItem value="portrait">Portrait</MenuItem>
          </SelectField>
        </Grid>
      </Grid>

      <ToggleField
        label="Show brand descriptions"
        checked={value.showDescriptions}
        onChange={(val) => update('showDescriptions', val)}
      />
      <ToggleField
        label="Show product count badges"
        checked={value.showProductCount}
        onChange={(val) => update('showProductCount', val)}
      />
      <ToggleField
        label="Show alphabetical filter"
        checked={value.showAlphabeticalFilter}
        onChange={(val) => update('showAlphabeticalFilter', val)}
      />

      <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 2, mb: 1.5 }}>
        Featured Brands
      </Typography>
      <ToggleField
        label="Show featured brand section"
        checked={value.showFeaturedSection}
        onChange={(val) => update('showFeaturedSection', val)}
      />
      <SelectField
        label="Featured Layout"
        value={value.featuredLayout || 'banner'}
        onChange={(val) => update('featuredLayout', val)}
      >
        <MenuItem value="banner">Banner</MenuItem>
        <MenuItem value="carousel">Carousel</MenuItem>
        <MenuItem value="grid">Grid</MenuItem>
      </SelectField>
      <TextField
        label="Featured Count"
        value={value.featuredCount || 3}
        onChange={(e) => update('featuredCount', Number(e.target.value) || 3)}
        type="number"
        fullWidth
        size="small"
      />
    </Box>
  );
};


// ─── ACCOUNT PAGE EDITOR ───────────────────────────────────────────────────
export const AccountPageStyleEditor = ({ value = {}, onChange }) => {
  const update = (key, val) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>
        Account Page Layout
      </Typography>

      <SelectField
        label="Account Navigation Layout"
        value={value.layout || 'tabs'}
        onChange={(val) => update('layout', val)}
      >
        <MenuItem value="tabs">Tabs - compact horizontal navigation</MenuItem>
        <MenuItem value="sidebar">Sidebar - dashboard style navigation</MenuItem>
      </SelectField>

      <ToggleField
        label="Show support information block"
        checked={value.showSupportInfo === true}
        onChange={(val) => update('showSupportInfo', val)}
      />
    </Box>
  );
};


// ─── CART PAGE EDITOR ─────────────────────────────────────────────────────────
export const CartPageStyleEditor = ({ value = {}, onChange }) => {
  const update = (key, val) => onChange({ ...value, [key]: val });
  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>Cart Layout</Typography>

      <SelectField label="Layout Style" value={value.layout || 'standard'} onChange={(val) => update('layout', val)}>
        <MenuItem value="standard">Standard — items left, summary right</MenuItem>
        <MenuItem value="stacked">Stacked — items above summary</MenuItem>
      </SelectField>

      <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 2, mb: 1.5 }}>Features</Typography>
      <Grid container spacing={1}>
        <Grid item xs={12} sm={6}><ToggleField label="Show coupon / discount field" checked={value.showCoupon} onChange={(v) => update('showCoupon', v)} /></Grid>
        <Grid item xs={12} sm={6}><ToggleField label="Show savings summary" checked={value.showSavings} onChange={(v) => update('showSavings', v)} /></Grid>
        <Grid item xs={12} sm={6}><ToggleField label="Show shipping estimator" checked={value.showShippingEstimator} onChange={(v) => update('showShippingEstimator', v)} /></Grid>
        <Grid item xs={12} sm={6}><ToggleField label="Show recently viewed below cart" checked={value.showRecentlyViewed} onChange={(v) => update('showRecentlyViewed', v)} /></Grid>
        <Grid item xs={12} sm={6}><ToggleField label="Show order notes field" checked={value.showOrderNotes} onChange={(v) => update('showOrderNotes', v)} /></Grid>
      </Grid>

      <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 2, mb: 1.5 }}>Labels</Typography>
      <TextField label="Empty Cart Headline" value={value.emptyHeadline || 'Your cart is empty'} onChange={(e) => update('emptyHeadline', e.target.value)} fullWidth size="small" sx={{ mb: 2 }} />
      <TextField label="Empty Cart Button Label" value={value.emptyCtaLabel || 'Browse Products'} onChange={(e) => update('emptyCtaLabel', e.target.value)} fullWidth size="small" sx={{ mb: 2 }} />
      <TextField label="Checkout Button Label" value={value.checkoutLabel || 'Proceed to Checkout'} onChange={(e) => update('checkoutLabel', e.target.value)} fullWidth size="small" />
    </Box>
  );
};


// ─── CHECKOUT PAGE EDITOR ─────────────────────────────────────────────────────
export const CheckoutPageStyleEditor = ({ value = {}, onChange }) => {
  const update = (key, val) => onChange({ ...value, [key]: val });
  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>Checkout Layout</Typography>

      <SelectField label="Layout Style" value={value.layout || 'two-column'} onChange={(val) => update('layout', val)}>
        <MenuItem value="two-column">Two-column — form left, summary right</MenuItem>
        <MenuItem value="one-column">One-column — stacked</MenuItem>
        <MenuItem value="accordion">Accordion — collapsed steps</MenuItem>
      </SelectField>

      <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 2, mb: 1.5 }}>Features</Typography>
      <Grid container spacing={1}>
        <Grid item xs={12} sm={6}><ToggleField label="Show order summary sidebar" checked={value.showOrderSummary} onChange={(v) => update('showOrderSummary', v)} /></Grid>
        <Grid item xs={12} sm={6}><ToggleField label="Allow guest checkout" checked={value.allowGuestCheckout} onChange={(v) => update('allowGuestCheckout', v)} /></Grid>
        <Grid item xs={12} sm={6}><ToggleField label="Show coupon field at checkout" checked={value.showCoupon} onChange={(v) => update('showCoupon', v)} /></Grid>
        <Grid item xs={12} sm={6}><ToggleField label="Show shipping step" checked={value.showShippingStep} onChange={(v) => update('showShippingStep', v)} /></Grid>
        <Grid item xs={12} sm={6}><ToggleField label="Show order notes field" checked={value.showOrderNotes} onChange={(v) => update('showOrderNotes', v)} /></Grid>
      </Grid>

      <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 2, mb: 1.5 }}>Labels</Typography>
      <TextField label="Place Order Button Label" value={value.placeOrderLabel || 'Place Order'} onChange={(e) => update('placeOrderLabel', e.target.value)} fullWidth size="small" sx={{ mb: 2 }} />
      <TextField label="Payment Section Heading" value={value.paymentHeading || 'Payment'} onChange={(e) => update('paymentHeading', e.target.value)} fullWidth size="small" />
    </Box>
  );
};


// ─── SEARCH PAGE EDITOR ───────────────────────────────────────────────────────
export const SearchPageStyleEditor = ({ value = {}, onChange }) => {
  const update = (key, val) => onChange({ ...value, [key]: val });
  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>Search Results Layout</Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <SelectField label="Grid Columns" value={num(value.gridColumns, 4)} onChange={(val) => update('gridColumns', Number(val))}>
            <MenuItem value={2}>2 — Wide cards</MenuItem>
            <MenuItem value={3}>3 columns</MenuItem>
            <MenuItem value={4}>4 columns</MenuItem>
          </SelectField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <SelectField label="Default Sort" value={value.defaultSort || 'relevance'} onChange={(val) => update('defaultSort', val)}>
            <MenuItem value="relevance">Relevance</MenuItem>
            <MenuItem value="newest">Newest</MenuItem>
            <MenuItem value="price_asc">Price: Low to High</MenuItem>
            <MenuItem value="price_desc">Price: High to Low</MenuItem>
          </SelectField>
        </Grid>
      </Grid>

      <Grid container spacing={1}>
        <Grid item xs={12} sm={6}><ToggleField label="Show filter sidebar" checked={value.showFilters} onChange={(v) => update('showFilters', v)} /></Grid>
        <Grid item xs={12} sm={6}><ToggleField label="Show sort bar" checked={value.showSortBar} onChange={(v) => update('showSortBar', v)} /></Grid>
        <Grid item xs={12} sm={6}><ToggleField label="Show result count" checked={value.showResultCount} onChange={(v) => update('showResultCount', v)} /></Grid>
      </Grid>

      <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 2, mb: 1.5 }}>Labels</Typography>
      <TextField label="Search Input Placeholder" value={value.searchPlaceholder || 'Search products…'} onChange={(e) => update('searchPlaceholder', e.target.value)} fullWidth size="small" sx={{ mb: 2 }} />
      <TextField label="No Results Message" value={value.noResultsMessage || 'No products found for your search.'} onChange={(e) => update('noResultsMessage', e.target.value)} fullWidth size="small" multiline rows={2} />
    </Box>
  );
};


// ─── 404 PAGE EDITOR ──────────────────────────────────────────────────────────
export const NotFoundPageStyleEditor = ({ value = {}, onChange }) => {
  const update = (key, val) => onChange({ ...value, [key]: val });
  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>404 Page Content</Typography>

      <TextField label="Headline" value={value.headline || 'Page Not Found'} onChange={(e) => update('headline', e.target.value)} fullWidth size="small" sx={{ mb: 2 }} />
      <TextField label="Sub-text" value={value.subtext || "Sorry, the page you're looking for doesn't exist or has been moved."} onChange={(e) => update('subtext', e.target.value)} fullWidth size="small" multiline rows={2} sx={{ mb: 2 }} />

      <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 2, mb: 1.5 }}>CTA Buttons</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}><TextField label="Primary Button Label" value={value.cta1Label || 'Browse Products'} onChange={(e) => update('cta1Label', e.target.value)} fullWidth size="small" sx={{ mb: 2 }} /></Grid>
        <Grid item xs={12} sm={6}><TextField label="Primary Button Link" value={value.cta1Link || '/products'} onChange={(e) => update('cta1Link', e.target.value)} fullWidth size="small" sx={{ mb: 2 }} /></Grid>
        <Grid item xs={12} sm={6}><TextField label="Secondary Button Label" value={value.cta2Label || 'Go Home'} onChange={(e) => update('cta2Label', e.target.value)} fullWidth size="small" /></Grid>
        <Grid item xs={12} sm={6}><TextField label="Secondary Button Link" value={value.cta2Link || '/'} onChange={(e) => update('cta2Link', e.target.value)} fullWidth size="small" /></Grid>
      </Grid>
    </Box>
  );
};


// ─── ORDERS PAGE EDITOR ───────────────────────────────────────────────────────
export const OrdersPageStyleEditor = ({ value = {}, onChange }) => {
  const update = (key, val) => onChange({ ...value, [key]: val });
  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>Orders List Layout</Typography>

      <SelectField label="Layout Style" value={value.layout || 'list'} onChange={(val) => update('layout', val)}>
        <MenuItem value="list">List — full-width rows</MenuItem>
        <MenuItem value="cards">Cards — grid of order cards</MenuItem>
      </SelectField>

      <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 2, mb: 1.5 }}>Visibility</Typography>
      <Grid container spacing={1}>
        <Grid item xs={12} sm={6}><ToggleField label="Show order status badges" checked={value.showStatusBadge} onChange={(v) => update('showStatusBadge', v)} /></Grid>
        <Grid item xs={12} sm={6}><ToggleField label="Show item thumbnails" checked={value.showThumbnails} onChange={(v) => update('showThumbnails', v)} /></Grid>
        <Grid item xs={12} sm={6}><ToggleField label="Show order total" checked={value.showTotal} onChange={(v) => update('showTotal', v)} /></Grid>
        <Grid item xs={12} sm={6}><ToggleField label="Show tracking link" checked={value.showTracking} onChange={(v) => update('showTracking', v)} /></Grid>
      </Grid>

      <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 2, mb: 1.5 }}>Labels</Typography>
      <TextField label="Empty Orders Headline" value={value.emptyHeadline || "You haven't placed any orders yet"} onChange={(e) => update('emptyHeadline', e.target.value)} fullWidth size="small" sx={{ mb: 2 }} />
      <TextField label="Empty Orders CTA Label" value={value.emptyCtaLabel || 'Start Shopping'} onChange={(e) => update('emptyCtaLabel', e.target.value)} fullWidth size="small" />
    </Box>
  );
};
