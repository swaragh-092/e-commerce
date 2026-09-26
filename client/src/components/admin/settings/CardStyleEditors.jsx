import React, { useEffect, useState } from 'react';
import { Box, FormControlLabel, Grid, Paper, Switch, Typography, Chip, Button, Stack, TextField, IconButton, Divider, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { COMPONENT_STYLE_DEFAULTS } from '../../../utils/componentStyles';
import { resolveRadius, resolveShadow } from '../../../utils/styleMaps';
import { getProducts } from '../../../services/productService';
import { getCategories } from '../../../services/categoryService';
import { getMediaUrl } from '../../../utils/media';
import { getDesignComponentControlSchema } from '../../../utils/designRegistry';
import { DesignSchemaFields } from '../themes/designer/DesignSchemaFields';

const usePreviewData = () => {
  const [product, setProduct] = useState(null);
  const [category, setCategory] = useState(null);

  useEffect(() => {
    getProducts({ limit: 1 }).then(res => {
      if (res.data?.data?.[0]) setProduct(res.data.data[0]);
    }).catch(() => {});

    getCategories().then(res => {
      if (res?.[0]) setCategory(res[0]);
    }).catch(() => {});
  }, []);

  return { product, category };
};

const mergeStyle = (componentName, value) => ({
  ...(COMPONENT_STYLE_DEFAULTS[componentName] || {}),
  ...(value && typeof value === 'object' ? value : {}),
});

const PresetPicker = ({ title = 'Start with a preset', presets = [], activeValue, onApply }) => (
  <Box sx={{ mb: 2.5 }}>
    <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 1 }}>
      {title}
    </Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
      {presets.map((preset) => (
        <Paper
          key={preset.id}
          variant="outlined"
          onClick={() => onApply(preset.values)}
          sx={{
            p: 1.25,
            cursor: 'pointer',
            borderColor: activeValue === preset.values.variant || activeValue === preset.id ? 'primary.main' : 'divider',
            bgcolor: activeValue === preset.values.variant || activeValue === preset.id ? 'action.hover' : 'background.paper',
            transition: 'all 0.15s ease',
            '&:hover': { borderColor: 'primary.main', transform: 'translateY(-1px)' },
          }}
        >
          <Typography variant="body2" fontWeight={900}>{preset.label}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>{preset.description}</Typography>
        </Paper>
      ))}
    </Box>
  </Box>
);

const PRODUCT_CARD_PRESETS = [
  { id: 'classic', label: 'Classic', description: 'Balanced retail card.', values: { variant: 'classic', imageRatio: '4/3', shadow: 'soft', radius: 'medium', density: 'comfortable', showBrand: true, showCategory: true, showRating: true, showWishlist: true, hoverEffect: 'lift' } },
  { id: 'marketplace', label: 'Marketplace', description: 'CTA-heavy selling card.', values: { variant: 'marketplace', imageRatio: '1/1', shadow: 'medium', radius: 'small', density: 'comfortable', showBrand: true, showCategory: false, showRating: true, showWishlist: true, hoverEffect: 'lift' } },
  { id: 'editorial', label: 'Editorial', description: 'Large visual, minimal meta.', values: { variant: 'editorial', imageRatio: '4/5', shadow: 'none', radius: 'large', density: 'spacious', showBrand: true, showCategory: false, showRating: false, showWishlist: false, hoverEffect: 'zoom' } },
  { id: 'deal', label: 'Deal', description: 'Sale/urgency treatment.', values: { variant: 'deal', imageRatio: '1/1', shadow: 'strong', radius: 'medium', density: 'compact', showBrand: false, showCategory: true, showRating: true, showWishlist: true, showSaleCountdown: true, hoverEffect: 'lift' } },
  { id: 'minimal', label: 'Minimal', description: 'Clean catalog browsing.', values: { variant: 'minimal', imageRatio: '3/4', shadow: 'none', radius: 'none', density: 'compact', showBrand: false, showCategory: false, showRating: false, showWishlist: false, hoverEffect: 'fade' } },
];

const CATEGORY_CARD_PRESETS = [
  { id: 'image-tile', label: 'Image Tiles', description: 'Visual shopping grid.', values: { variant: 'image-tile', imageRatio: '1/1', titlePlacement: 'below', density: 'comfortable', hoverEffect: 'zoom', radius: 'medium', shadow: 'none', showSubtitle: false, showProductCount: false } },
  { id: 'editorial', label: 'Editorial', description: 'Large overlay category cards.', values: { variant: 'image-tile', imageRatio: '16/9', titlePlacement: 'overlay', density: 'spacious', hoverEffect: 'lift', radius: 'large', shadow: 'soft', showSubtitle: true, showProductCount: true } },
  { id: 'icon-grid', label: 'Icon Grid', description: 'Fast mobile category scan.', values: { variant: 'icon-grid', imageRatio: '1/1', titlePlacement: 'below', density: 'compact', hoverEffect: 'none', radius: 'pill', shadow: 'none', showSubtitle: false, showProductCount: false } },
  { id: 'compact-chips', label: 'Compact Chips', description: 'Dense category navigation.', values: { variant: 'compact-chips', imageRatio: '1/1', titlePlacement: 'below', density: 'compact', hoverEffect: 'fade', radius: 'pill', shadow: 'none', showSubtitle: false, showProductCount: true } },
];

const HEADER_PRESETS = [
  { id: 'minimal', label: 'Minimal', description: 'Simple sticky header.', values: { nav: { sticky: true, showCategoryBar: false }, announcement: { enabled: false } } },
  { id: 'retail', label: 'Retail', description: 'Announcement + categories.', values: { nav: { sticky: true, showCategoryBar: true }, announcement: { enabled: true, dismissible: true, text: 'Free shipping on eligible orders' } } },
  { id: 'campaign', label: 'Campaign', description: 'Promo-first announcement.', values: { nav: { sticky: true, showCategoryBar: true }, announcement: { enabled: true, dismissible: true, text: 'Limited time sale - shop new offers', bgColor: '#111827', fgColor: '#ffffff' } } },
];

// Admin preview tile radius scale. Kept as MUI theme multipliers so the
// preview tiles stay compact in the editor sidebar (small/medium/large map
// to 12/20/32/48px with the default borderRadius). The actual storefront
// cards use the shared absolute-CSS styleMaps.js — see issue H3.
const radiusMap = {
  none: 0,
  small: 1.5,
  medium: 2.5,
  large: 4,
  pill: 6,
};

const shadowMap = {
  none: 'none',
  soft: 'rgba(15, 23, 42, 0.08) 0px 4px 14px',
  medium: 'rgba(15, 23, 42, 0.12) 0px 10px 28px',
  strong: 'rgba(15, 23, 42, 0.18) 0px 18px 44px',
};

const ProductCardPreview = ({ style, product }) => {
  const price = product ? `$${product.price}` : '$129.00';
  const brand = product?.brand?.name || 'Brand';
  const categoryName = product?.categories?.[0]?.name || 'Category';
  const name = product?.name || 'Product Name';
  const image = product?.image || product?.images?.[0];
  const cardRadius = radiusMap[style.radius] ?? radiusMap.medium;
  const cardShadow = shadowMap[style.shadow] || shadowMap.soft;
  const isMinimal = style.variant === 'minimal';
  const isCompact = style.variant === 'compact' || style.density === 'compact';
  const titleLines = Math.max(1, Math.min(4, Number.parseInt(style.titleLines, 10) || 2));
  const contentAlign = style.contentAlign || 'left';
  const imageInset = style.imagePadding === 'comfortable' ? 1.25 : style.imagePadding === 'spacious' ? 2 : 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        width: '100%',
        maxWidth: { xs: 280, sm: 320 },
        mx: 'auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: cardRadius,
        overflow: 'hidden',
        border: style.variant === 'deal' ? '2px solid' : (isMinimal ? '1px solid' : 'none'),
        borderColor: style.variant === 'deal' ? 'error.main' : 'divider',
        boxShadow: style.variant === 'deal' ? '0 10px 30px rgba(239, 68, 68, 0.15)' : (isMinimal ? 'none' : cardShadow),
      }}
    >
      <Box sx={{ aspectRatio: String(style.imageRatio || '4/3').replace('/', ' / '), bgcolor: 'action.hover', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden', p: imageInset }}>
        {style.variant === 'deal' && (
          <Chip
            label="DEAL OF THE DAY"
            color="error"
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 2,
              fontWeight: 900,
              fontSize: '0.68rem',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              boxShadow: '0 4px 10px rgba(239, 68, 68, 0.4)',
            }}
          />
        )}
        {image ? (
          <Box component="img" src={getMediaUrl(image)} sx={{ position: 'absolute', inset: imageInset ? `${imageInset * 8}px` : 0, width: imageInset ? `calc(100% - ${imageInset * 16}px)` : '100%', height: imageInset ? `calc(100% - ${imageInset * 16}px)` : '100%', borderRadius: imageInset ? Math.max(0, cardRadius - 1) : 0, objectFit: style.imageFit || 'cover' }} />
        ) : (
          <Typography variant="caption" color="text.secondary">Product Image</Typography>
        )}
      </Box>
      <Box sx={{ p: isCompact ? 1.25 : 2, display: 'flex', flexDirection: 'column', flexGrow: 1, textAlign: contentAlign, alignItems: contentAlign === 'center' ? 'center' : contentAlign === 'right' ? 'flex-end' : 'stretch' }}>
        <Box sx={{ minHeight: isCompact ? 16 : 32, mb: 0.5 }}>
          {style.showBrand !== false && !isCompact && <Typography variant="caption" color="primary" fontWeight={800} sx={{ display: 'block' }}>{brand}</Typography>}
          {style.showCategory !== false && <Typography variant="caption" color="text.secondary" display="block">{categoryName}</Typography>}
        </Box>
        <Typography fontWeight={900} sx={{ mt: 0.5, display: '-webkit-box', WebkitLineClamp: titleLines, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.2 }}>{name}</Typography>
        {style.showRating !== false && !isCompact && <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>★★★★★</Typography>}

        {style.variant === 'deal' && (
          <Box sx={{ mt: 1, mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="error.main" sx={{ fontWeight: 800 }}>
                🔥 Limited Deal
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                64% Claimed
              </Typography>
            </Box>
            <Box sx={{ width: '100%', height: 6, bgcolor: 'action.hover', borderRadius: 3, overflow: 'hidden' }}>
              <Box sx={{ width: '64%', height: '100%', bgcolor: 'error.main', borderRadius: 3 }} />
            </Box>
          </Box>
        )}

        <Box sx={{ flexGrow: 1 }} />
        <Typography color="primary" fontWeight={style.priceStyle === 'regular' ? 700 : 950} sx={{ mt: 1 }}>{price}</Typography>
      </Box>
      {style.variant === 'marketplace' && (
        <Box sx={{ px: 2, pb: 2 }}>
          <Button variant="contained" size="small" fullWidth sx={{ borderRadius: '8px', fontWeight: 700, pointerEvents: 'none' }}>
            Add to Cart
          </Button>
        </Box>
      )}
    </Paper>
  );
};

const CategoryCardPreview = ({ style, category }) => {
  const overlay = style.titlePlacement === 'overlay' || style.titlePlacement === 'centered';
  const name = category?.name || 'Category';
  const image = category?.image;

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: style.radius === 'large' ? 4 : style.radius === 'small' ? 1.5 : 2.5,
        overflow: 'hidden',
        boxShadow: style.shadow === 'none' ? 'none' : '0 16px 36px rgba(15, 23, 42, 0.12)',
      }}
    >
      <Box sx={{ p: overlay ? 0 : 1.25 }}>
        <Box sx={{ aspectRatio: String(style.imageRatio || '1/1').replace('/', ' / '), bgcolor: 'action.hover', borderRadius: overlay ? 0 : 2, display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden' }}>
          {image ? (
            <Box component="img" src={getMediaUrl(image)} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Typography variant="h4" color="primary" fontWeight={950}>{name[0]}</Typography>
          )}
          {overlay && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: style.titlePlacement === 'centered' ? 'center' : 'flex-end', justifyContent: 'center', p: 1.25, background: 'linear-gradient(180deg, transparent, rgba(15,23,42,.72))' }}>
              <Typography color="white" fontWeight={900}>{name}</Typography>
            </Box>
          )}
        </Box>
        {!overlay && <Typography textAlign="center" fontWeight={900} sx={{ mt: 1 }}>{name}</Typography>}
      </Box>
    </Paper>
  );
};


const PromoCardPreview = ({ style }) => (
  <Paper
    variant="outlined"
    sx={{
      borderRadius: style.radius === 'large' ? 4 : style.radius === 'small' ? 1.5 : 2.5,
      boxShadow: style.shadow === 'none' ? 'none' : '0 16px 36px rgba(15, 23, 42, 0.12)',
      p: 2,
      minHeight: 170,
      display: 'flex',
      flexDirection: style.imagePlacement === 'top' ? 'column-reverse' : style.imagePlacement === 'left' ? 'row-reverse' : 'row',
      gap: 2,
      alignItems: 'center',
    }}
  >
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="caption" color="primary" fontWeight={900}>Promo</Typography>
      <Typography variant={style.titleSize === 'small' ? 'subtitle1' : style.titleSize === 'medium' ? 'h6' : 'h5'} fontWeight={950}>Campaign Banner</Typography>
      <Typography variant="caption" color="text.secondary">A flexible promotion card.</Typography>
      {style.ctaStyle !== 'hidden' && <Typography color="primary" fontWeight={900} sx={{ mt: 1 }}>{style.ctaStyle === 'button' ? '[ Button ]' : 'Text link ->'}</Typography>}
    </Box>
    <Box sx={{ width: style.imagePlacement === 'top' ? '100%' : 72, height: 72, borderRadius: 2, bgcolor: 'action.hover' }} />
  </Paper>
);

const BrandCardPreview = ({ style }) => (
  <Paper
    variant="outlined"
    sx={{
      borderRadius: style.radius === 'large' ? 4 : style.radius === 'small' ? 1.5 : style.radius === 'pill' ? 8 : 2.5,
      boxShadow: style.shadow === 'none' ? 'none' : '0 16px 36px rgba(15, 23, 42, 0.12)',
      p: style.variant === 'logo-only' ? 1.25 : 2,
      minHeight: style.variant === 'logo-only' ? 110 : 150,
      display: 'grid',
      placeItems: 'center',
      textAlign: 'center',
    }}
  >
    <Box sx={{ width: 76, height: 54, borderRadius: 2, bgcolor: 'action.hover', display: 'grid', placeItems: 'center', mb: style.variant === 'logo-only' ? 0 : 1 }}>
      <Typography fontWeight={950} color="primary">BR</Typography>
    </Box>
    {style.variant !== 'logo-only' && <Typography fontWeight={900}>Brand Name</Typography>}
  </Paper>
);

const TrustCardPreview = ({ style }) => (
  <Paper
    variant="outlined"
    sx={{
      borderRadius: style.radius === 'large' ? 4 : style.radius === 'small' ? 1.5 : style.radius === 'pill' ? 8 : 2.5,
      boxShadow: style.shadow === 'none' ? 'none' : '0 16px 36px rgba(15, 23, 42, 0.12)',
      p: 2,
      minHeight: 130,
      display: 'flex',
      flexDirection: style.variant === 'card-grid' ? 'column' : 'row',
      gap: 1.5,
      alignItems: style.variant === 'card-grid' ? 'flex-start' : 'center',
    }}
  >
    <Box sx={{ width: 42, height: 42, borderRadius: 999, bgcolor: 'primary.light' }} />
    <Box>
      <Typography variant={style.titleSize === 'large' ? 'h6' : style.titleSize === 'small' ? 'body2' : 'subtitle1'} fontWeight={950}>Secure Checkout</Typography>
      <Typography variant="caption" color="text.secondary">Trust message preview</Typography>
    </Box>
  </Paper>
);

export const ProductCardStyleEditor = ({ value, onChange, isSidebar }) => {
  const style = mergeStyle('productCard', value);
  const { product } = usePreviewData();

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: isSidebar ? '1fr' : { xs: '1fr', xl: 'minmax(0, 1fr) minmax(240px, 320px)' }, gap: 2, alignItems: 'start', minWidth: 0 }}>
      <Box sx={{ minWidth: 0 }}>
        <PresetPicker
          title="Product card presets"
          presets={PRODUCT_CARD_PRESETS}
          activeValue={style.variant}
          onApply={(values) => onChange({ ...style, ...values })}
        />
        <DesignSchemaFields
          schema={getDesignComponentControlSchema('productCard')}
          value={style}
          onChange={onChange}
        />
      </Box>
      {!isSidebar && (
        <Box sx={{ minWidth: 0, position: { xl: 'sticky' }, top: { xl: 12 } }}>
          <ProductCardPreview style={style} product={product} />
        </Box>
      )}
    </Box>
  );
};

export const CategoryCardStyleEditor = ({ value, onChange, isSidebar }) => {
  const style = mergeStyle('categoryCard', value);
  const { category } = usePreviewData();

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={isSidebar ? 12 : 8}>
        <PresetPicker
          title="Category card presets"
          presets={CATEGORY_CARD_PRESETS}
          activeValue={style.variant}
          onApply={(values) => onChange({ ...style, ...values })}
        />
        <DesignSchemaFields
          schema={getDesignComponentControlSchema('categoryCard')}
          value={style}
          onChange={onChange}
        />
      </Grid>
      {!isSidebar && (
        <Grid item xs={12} md={4}>
          <CategoryCardPreview style={style} category={category} />
        </Grid>
      )}
    </Grid>
  );
};


export const PromoCardStyleEditor = ({ value, onChange, isSidebar }) => {
  const style = mergeStyle('promoCard', value);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={isSidebar ? 12 : 8}>
        <DesignSchemaFields schema={getDesignComponentControlSchema('promoCard')} value={style} onChange={onChange} />
      </Grid>
      {!isSidebar && <Grid item xs={12} md={4}><PromoCardPreview style={style} /></Grid>}
    </Grid>
  );
};

export const BrandCardStyleEditor = ({ value, onChange, isSidebar }) => {
  const style = mergeStyle('brandCard', value);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={isSidebar ? 12 : 8}>
        <DesignSchemaFields schema={getDesignComponentControlSchema('brandCard')} value={style} onChange={onChange} />
      </Grid>
      {!isSidebar && <Grid item xs={12} md={4}><BrandCardPreview style={style} /></Grid>}
    </Grid>
  );
};

export const TrustCardStyleEditor = ({ value, onChange, isSidebar }) => {
  const style = mergeStyle('trustCard', value);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={isSidebar ? 12 : 8}>
        <DesignSchemaFields schema={getDesignComponentControlSchema('trustCard')} value={style} onChange={onChange} />
      </Grid>
      {!isSidebar && <Grid item xs={12} md={4}><TrustCardPreview style={style} /></Grid>}
    </Grid>
  );
};


export const CartItemStyleEditor = ({ value, onChange }) => {
  const style = mergeStyle('cartItem', value);

  return <DesignSchemaFields schema={getDesignComponentControlSchema('cartItem')} value={style} onChange={onChange} />;
};

export const CheckoutBlockStyleEditor = ({ value, onChange }) => {
  const style = mergeStyle('checkoutBlock', value);

  return <DesignSchemaFields schema={getDesignComponentControlSchema('checkoutBlock')} value={style} onChange={onChange} />;
};


export const FormControlStyleEditor = ({ value, onChange, isSidebar }) => {
  const style = mergeStyle('formControl', value);

  return (
    <Grid container spacing={2} alignItems="stretch">
      <Grid item xs={12} md={isSidebar ? 12 : 8}>
        <DesignSchemaFields schema={getDesignComponentControlSchema('formControl')} value={style} onChange={onChange} />
      </Grid>
      {!isSidebar && (
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: style.radius === 'pill' ? 6 : style.radius === 'large' ? 4 : style.radius === 'small' ? 1.5 : 2.5 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={800}>Preview</Typography>
            <Stack spacing={1.25} sx={{ mt: 1 }}>
              <TextField size={style.density === 'spacious' ? 'medium' : 'small'} variant={style.variant === 'filled' ? 'filled' : 'outlined'} label={style.labelStyle === 'placeholder' ? undefined : 'Email'} placeholder="Email address" fullWidth />
              <TextField size={style.density === 'spacious' ? 'medium' : 'small'} variant={style.variant === 'filled' ? 'filled' : 'outlined'} label={style.labelStyle === 'placeholder' ? undefined : 'Coupon'} placeholder="WELCOME10" fullWidth />
            </Stack>
          </Paper>
        </Grid>
      )}
    </Grid>
  );
};

export const BadgeChipStyleEditor = ({ value, onChange }) => {
  const style = mergeStyle('badgeChip', value);

  return (
    <Grid container spacing={2} alignItems="stretch">
      <Grid item xs={12} md={8}>
        <DesignSchemaFields schema={getDesignComponentControlSchema('badgeChip')} value={style} onChange={onChange} />
      </Grid>
      <Grid item xs={12} md={4}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={800}>Preview</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            <Chip label="In Stock" color="success" size={style.size === 'medium' ? 'medium' : 'small'} variant={style.variant === 'outline' ? 'outlined' : 'filled'} sx={{ borderRadius: style.radius === 'pill' ? 999 : style.radius === 'large' ? 3 : style.radius === 'small' ? 1 : 1.75, fontWeight: style.weight === 'regular' ? 500 : style.weight === 'black' ? 950 : 800, textTransform: style.textTransform === 'none' ? 'none' : 'uppercase', letterSpacing: style.letterSpacing || 0 }} />
            <Chip label="Sale" color="error" size={style.size === 'medium' ? 'medium' : 'small'} variant={style.variant === 'outline' ? 'outlined' : 'filled'} sx={{ borderRadius: style.radius === 'pill' ? 999 : style.radius === 'large' ? 3 : style.radius === 'small' ? 1 : 1.75, fontWeight: style.weight === 'regular' ? 500 : style.weight === 'black' ? 950 : 800, textTransform: style.textTransform === 'none' ? 'none' : 'uppercase', letterSpacing: style.letterSpacing || 0 }} />
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  );
};

export const HeaderStyleEditor = ({ value, onChange }) => {
  const nav = value?.nav || {};
  const announcement = value?.announcement || {};

  const updateNav = (key, val) => {
    onChange({
      ...value,
      nav: { ...nav, [key]: val }
    });
  };

  const updateAnnouncement = (key, val) => {
    onChange({
      ...value,
      announcement: { ...announcement, [key]: val }
    });
  };

  return (
    <Stack spacing={3}>
      <PresetPicker
        title="Header presets"
        presets={HEADER_PRESETS}
        activeValue={announcement.enabled === true || announcement.enabled === 'true' ? 'retail' : 'minimal'}
        onApply={(values) => onChange({
          ...value,
          nav: { ...nav, ...(values.nav || {}) },
          announcement: { ...announcement, ...(values.announcement || {}) },
        })}
      />
      <Box>
        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>Navigation Bar</Typography>
        <Stack spacing={1}>
          <FormControlLabel
            control={<Switch size="small" checked={nav.sticky !== false} onChange={(e) => updateNav('sticky', e.target.checked)} />}
            label="Sticky navbar — stays visible while scrolling"
          />
          <FormControlLabel
            control={<Switch size="small" checked={nav.showCategoryBar !== false} onChange={(e) => updateNav('showCategoryBar', e.target.checked)} />}
            label="Show category bar below the navbar"
          />
        </Stack>
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>Announcement Bar</Typography>
        <FormControlLabel
          control={<Switch size="small" checked={announcement.enabled === true || announcement.enabled === 'true'} onChange={(e) => updateAnnouncement('enabled', e.target.checked)} />}
          label="Show announcement bar at the top"
        />
        {(announcement.enabled === true || announcement.enabled === 'true') && (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="Message Text"
              value={announcement.text || ''}
              onChange={(e) => updateAnnouncement('text', e.target.value)}
              inputProps={{ maxLength: 200 }}
              helperText={`${(announcement.text || '').length}/200`}
            />
            <TextField
              fullWidth
              size="small"
              label="Link URL (e.g. /products)"
              value={announcement.link || ''}
              onChange={(e) => updateAnnouncement('link', e.target.value)}
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  type="color"
                  label="Background Color"
                  value={announcement.bgColor || '#0f766e'}
                  onChange={(e) => updateAnnouncement('bgColor', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  type="color"
                  label="Text Color"
                  value={announcement.fgColor || '#ffffff'}
                  onChange={(e) => updateAnnouncement('fgColor', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
            <FormControlLabel
              control={<Switch size="small" checked={announcement.dismissible !== false} onChange={(e) => updateAnnouncement('dismissible', e.target.checked)} />}
              label="Show dismiss (✕) button"
            />
          </Stack>
        )}
      </Box>
    </Stack>
  );
};


const FooterBlock = ({ title, children, defaultExpanded = false }) => (
  <Accordion
    defaultExpanded={defaultExpanded}
    disableGutters
    elevation={0}
    sx={{
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: '8px !important',
      '&:before': { display: 'none' },
      overflow: 'hidden',
    }}
  >
    <AccordionSummary
      expandIcon={<ExpandMoreIcon fontSize="small" />}
      sx={{ px: 1.5, minHeight: 42, '& .MuiAccordionSummary-content': { my: 0.75 } }}
    >
      <Typography variant="subtitle2" fontWeight={800}>{title}</Typography>
    </AccordionSummary>
    <AccordionDetails sx={{ px: 1.5, pb: 2, pt: 0 }}>
      {children}
    </AccordionDetails>
  </Accordion>
);

export const FooterStyleEditor = ({ value, onChange }) => {
   const footer = value || {};
  const [links, setLinks] = useState(footer.links || []);

  useEffect(() => {
    if (footer.links) {
      setLinks(footer.links);
    }
  }, [footer.links]);

  const patch = (key, val) => {
    onChange({ ...footer, [key]: val });
  };

  const handleLinksChange = (newLinks) => {
    setLinks(newLinks);
    onChange({ ...footer, links: newLinks });
  };

  return (
    <Stack spacing={3}>
      <Box>
        <FormControlLabel
          control={<Switch size="small" checked={footer.enabled !== false} onChange={(e) => patch('enabled', e.target.checked)} />}
          label="Show Footer"
        />
      </Box>

      {footer.enabled !== false && (
        <>
          <FooterBlock title="Appearance" defaultExpanded>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  type="color"
                  label="Background Color"
                  value={footer.bgColor || '#1f2933'}
                  onChange={(e) => patch('bgColor', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  type="color"
                  label="Text Color"
                  value={footer.fgColor || '#f8fafc'}
                  onChange={(e) => patch('fgColor', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
          </FooterBlock>

          <FooterBlock title="Brand Column" defaultExpanded>
            <Stack spacing={2}>
              <TextField
                fullWidth
                size="small"
                label="Tagline"
                value={footer.tagline || ''}
                onChange={(e) => patch('tagline', e.target.value)}
                placeholder="Tagline shown below store name/logo"
              />
              <TextField
                fullWidth
                size="small"
                label="Copyright Line"
                value={footer.copyright || ''}
                onChange={(e) => patch('copyright', e.target.value)}
                placeholder="e.g. © {year} {storeName}"
              />
            </Stack>
          </FooterBlock>

          <FooterBlock title="Social Links Block">
            <FormControlLabel
              control={<Switch size="small" checked={footer.showSocial !== false} onChange={(e) => patch('showSocial', e.target.checked)} />}
              label="Show social icons"
            />
            {footer.showSocial !== false && (
              <Stack spacing={2} sx={{ mt: 1.5 }}>
                <TextField fullWidth size="small" label="Facebook URL" value={footer.facebook || ''} onChange={(e) => patch('facebook', e.target.value)} />
                <TextField fullWidth size="small" label="Instagram URL" value={footer.instagram || ''} onChange={(e) => patch('instagram', e.target.value)} />
                <TextField fullWidth size="small" label="Twitter / X URL" value={footer.twitter || ''} onChange={(e) => patch('twitter', e.target.value)} />
                <TextField fullWidth size="small" label="YouTube URL" value={footer.youtube || ''} onChange={(e) => patch('youtube', e.target.value)} />
                <TextField fullWidth size="small" label="LinkedIn URL" value={footer.linkedin || ''} onChange={(e) => patch('linkedin', e.target.value)} />
              </Stack>
            )}
          </FooterBlock>

          <FooterBlock title="Quick Links Column" defaultExpanded>
            <FormControlLabel
              control={<Switch size="small" checked={footer.showLinks !== false} onChange={(e) => patch('showLinks', e.target.checked)} />}
              label="Show quick links column"
            />
            {footer.showLinks !== false && (
              <Stack spacing={2} sx={{ mt: 1.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Column Heading"
                  value={footer.linksTitle || 'Quick Links'}
                  onChange={(e) => patch('linksTitle', e.target.value)}
                />
                <Stack spacing={1}>
                  {links.map((link, i) => (
                    <Accordion key={i} variant="outlined" disableGutters sx={{ '&:before': { display: 'none' } }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />} sx={{ minHeight: 38, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                        <Typography variant="caption" fontWeight={800} noWrap>
                          {link.label || `Footer link ${i + 1}`}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0 }}>
                        <Stack spacing={1.25}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Label"
                            value={link.label || ''}
                            onChange={(e) => {
                              const n = [...links];
                              n[i] = { ...n[i], label: e.target.value };
                              handleLinksChange(n);
                            }}
                          />
                          <TextField
                            fullWidth
                            size="small"
                            label="URL (e.g. /about)"
                            value={link.url || ''}
                            onChange={(e) => {
                              const n = [...links];
                              n[i] = { ...n[i], url: e.target.value };
                              handleLinksChange(n);
                            }}
                          />
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteOutlineIcon fontSize="small" />}
                            onClick={() => {
                              const n = links.filter((_, j) => j !== i);
                              handleLinksChange(n);
                            }}
                            sx={{ alignSelf: 'flex-start' }}
                          >
                            Remove Link
                          </Button>
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => handleLinksChange([...links, { label: '', url: '' }])}
                    sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                  >
                    Add Link
                  </Button>
                </Stack>
              </Stack>
            )}
          </FooterBlock>

          <FooterBlock title="Contact Column">
            <FormControlLabel
              control={<Switch size="small" checked={footer.showContact !== false} onChange={(e) => patch('showContact', e.target.checked)} />}
              label="Show contact column"
            />
            {footer.showContact !== false && (
              <Stack spacing={2} sx={{ mt: 1.5 }}>
                <TextField fullWidth size="small" label="Email Address" value={footer.email || ''} onChange={(e) => patch('email', e.target.value)} />
                <TextField fullWidth size="small" label="Phone Number" value={footer.phone || ''} onChange={(e) => patch('phone', e.target.value)} />
                <TextField
                  fullWidth
                  size="small"
                  label="Address"
                  multiline
                  rows={3}
                  value={footer.address || ''}
                  onChange={(e) => patch('address', e.target.value)}
                />
              </Stack>
            )}
          </FooterBlock>
        </>
      )}
    </Stack>
  );
};
