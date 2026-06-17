export const COMPONENT_STYLE_DEFAULTS = {
  productCard: {
    variant: 'classic',
    imageRatio: '4/3',
    imageFit: 'cover',
    showBrand: true,
    showCategory: true,
    showRating: true,
    showWishlist: true,
    showShare: false,
    showSaleCountdown: true,
    actionPlacement: 'footer',
    wishlistPosition: 'top-right',
    priceStyle: 'bold',
    badgeStyle: 'pill',
    badgePosition: 'top-right',
    titleLines: 2,
    contentAlign: 'left',
    imagePadding: 'none',
    hoverEffect: 'lift',
    radius: 'medium',
    shadow: 'soft',
    density: 'comfortable',
  },
  categoryCard: {
    variant: 'image-tile',
    imageRatio: '1/1',
    imageFit: 'cover',
    titlePlacement: 'below',
    showSubtitle: false,
    showProductCount: false,
    hoverEffect: 'zoom',
    radius: 'medium',
    shadow: 'none',
    density: 'comfortable',
  },
  promoCard: {
    variant: 'split-image',
    imagePlacement: 'right',
    titleSize: 'large',
    ctaStyle: 'button',
    radius: 'large',
    shadow: 'soft',
  },
  brandCard: {
    variant: 'logo-card',
    imageRatio: '1/1',
    hoverEffect: 'lift',
    radius: 'medium',
    shadow: 'none',
  },
  trustCard: {
    variant: 'icon-row',
    titleSize: 'medium',
    radius: 'medium',
    shadow: 'none',
  },
  reviewCard: {
    variant: 'quote-card',
    showRating: true,
    radius: 'large',
    shadow: 'soft',
  },
  contentCard: {
    variant: 'editorial',
    imageRatio: '16/9',
    titleSize: 'medium',
    hoverEffect: 'lift',
    radius: 'medium',
    shadow: 'soft',
  },
  cartItem: {
    variant: 'standard',
    imageRatio: '1/1',
    radius: 'medium',
    shadow: 'none',
    density: 'comfortable',
    showVariantPill: true,
    hoverEffect: 'lift',
  },
  checkoutBlock: {
    variant: 'boxed',
    radius: 'medium',
    shadow: 'none',
    density: 'comfortable',
    headerStyle: 'stripe',
    ctaStyle: 'solid',
  },
  formControl: {
    variant: 'outlined',
    radius: 'medium',
    density: 'comfortable',
    fill: 'paper',
    focusStyle: 'brand',
    labelStyle: 'floating',
  },
  badgeChip: {
    variant: 'soft',
    radius: 'pill',
    size: 'small',
    weight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
};

export const getComponentStyle = (settings, componentName) => ({
  ...(COMPONENT_STYLE_DEFAULTS[componentName] || {}),
  ...(settings?.componentStyles?.[componentName] || {}),
});

export const STYLE_RADIUS_VALUES = {
  none: 0,
  small: 1,
  medium: 1.75,
  large: 3,
  pill: 9999,
  full: 9999,
};

export const STYLE_SHADOW_VALUES = {
  none: 'none',
  soft: '0 8px 24px rgba(15, 23, 42, 0.08)',
  medium: '0 16px 36px rgba(15, 23, 42, 0.12)',
  strong: '0 24px 56px rgba(15, 23, 42, 0.18)',
};

export const getRadiusValue = (radius = 'medium') => STYLE_RADIUS_VALUES[radius] ?? STYLE_RADIUS_VALUES.medium;

export const getShadowValue = (shadow = 'none') => STYLE_SHADOW_VALUES[shadow] || STYLE_SHADOW_VALUES.none;

export const getFormControlSize = (style = {}) => style.density === 'spacious' ? 'medium' : 'small';

export const getFormControlSx = (style = {}) => {
  const radius = getRadiusValue(style.radius);
  const filled = style.fill === 'muted' || style.variant === 'filled';

  return {
    '& .MuiOutlinedInput-root, & .MuiFilledInput-root': {
      borderRadius: radius,
      bgcolor: filled ? 'action.hover' : style.fill === 'transparent' ? 'transparent' : 'background.paper',
      transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
      ...(style.focusStyle === 'glow'
        ? { '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(20, 184, 166, 0.16)' } }
        : {}),
      ...(style.focusStyle === 'underline'
        ? { '&.Mui-focused fieldset': { borderTopColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent' } }
        : {}),
    },
    '& .MuiInputBase-input': {
      py: style.density === 'compact' ? 1 : style.density === 'spacious' ? 1.55 : 1.25,
    },
  };
};

export const getBadgeChipProps = (style = {}) => ({
  size: style.size === 'medium' ? 'medium' : 'small',
  variant: style.variant === 'outline' ? 'outlined' : 'filled',
  sx: {
    borderRadius: getRadiusValue(style.radius),
    fontWeight: style.weight === 'regular' ? 500 : style.weight === 'black' ? 950 : 800,
    textTransform: style.textTransform === 'none' ? 'none' : 'uppercase',
    letterSpacing: style.letterSpacing || (style.textTransform === 'none' ? 0 : '0.04em'),
  },
});
