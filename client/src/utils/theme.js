const TYPOGRAPHY_SCALE_PRESETS = {
  compact: {
    h1: '2.125rem', h2: '1.75rem', h3: '1.5rem', h4: '1.25rem', h5: '1.1rem', h6: '1rem', body1: '0.95rem', body2: '0.85rem',
    fluid: { h1: 'clamp(1.9rem, 4.8vw, 2.8rem)', h2: 'clamp(1.6rem, 3.8vw, 2.25rem)', h3: 'clamp(1.35rem, 3vw, 1.9rem)', h4: 'clamp(1.15rem, 2.4vw, 1.5rem)', h5: 'clamp(1.05rem, 1.8vw, 1.25rem)', h6: '1rem' },
  },
  default: {
    h1: '2.5rem', h2: '2rem', h3: '1.75rem', h4: '1.5rem', h5: '1.25rem', h6: '1rem', body1: '1rem', body2: '0.875rem',
    fluid: { h1: 'clamp(2rem, 5vw, 3.25rem)', h2: 'clamp(1.7rem, 4vw, 2.5rem)', h3: 'clamp(1.45rem, 3vw, 2rem)', h4: 'clamp(1.25rem, 2.4vw, 1.65rem)', h5: 'clamp(1.1rem, 1.8vw, 1.35rem)', h6: '1rem' },
  },
  editorial: {
    h1: '3rem', h2: '2.35rem', h3: '1.9rem', h4: '1.55rem', h5: '1.3rem', h6: '1.05rem', body1: '1.05rem', body2: '0.95rem',
    fluid: { h1: 'clamp(2.35rem, 7vw, 4.75rem)', h2: 'clamp(1.95rem, 5.2vw, 3.4rem)', h3: 'clamp(1.6rem, 3.8vw, 2.35rem)', h4: 'clamp(1.3rem, 2.8vw, 1.85rem)', h5: 'clamp(1.15rem, 2vw, 1.45rem)', h6: '1.05rem' },
  },
  display: {
    h1: '3.5rem', h2: '2.75rem', h3: '2.15rem', h4: '1.7rem', h5: '1.35rem', h6: '1.1rem', body1: '1rem', body2: '0.9rem',
    fluid: { h1: 'clamp(2.6rem, 8vw, 5.5rem)', h2: 'clamp(2.1rem, 6vw, 4rem)', h3: 'clamp(1.7rem, 4.4vw, 2.75rem)', h4: 'clamp(1.35rem, 3vw, 2rem)', h5: 'clamp(1.15rem, 2vw, 1.5rem)', h6: '1.1rem' },
  },
  goldenRatio: {
    h1: '3.375rem', h2: '2.5rem', h3: '1.875rem', h4: '1.5rem', h5: '1.25rem', h6: '1rem', body1: '1.05rem', body2: '0.938rem',
    fluid: { h1: 'clamp(2.5rem, 7.2vw, 4.5rem)', h2: 'clamp(1.9rem, 5.2vw, 3.25rem)', h3: 'clamp(1.5rem, 3.8vw, 2.4rem)', h4: 'clamp(1.25rem, 2.8vw, 1.85rem)', h5: 'clamp(1.1rem, 2vw, 1.4rem)', h6: '1rem' },
  },
  minorThird: {
    h1: '2.986rem', h2: '2.488rem', h3: '2.074rem', h4: '1.728rem', h5: '1.44rem', h6: '1.2rem', body1: '1rem', body2: '0.833rem',
    fluid: { h1: 'clamp(2.2rem, 6.4vw, 4rem)', h2: 'clamp(1.85rem, 5vw, 3.1rem)', h3: 'clamp(1.55rem, 3.8vw, 2.5rem)', h4: 'clamp(1.3rem, 2.8vw, 2rem)', h5: 'clamp(1.15rem, 2vw, 1.55rem)', h6: '1.2rem' },
  },
};

const cssValue = (value, fallback) => (value === undefined || value === null || value === '' ? fallback : value);
const numeric = (value, fallback) => {
  const next = Number.parseFloat(value);
  return Number.isFinite(next) ? next : fallback;
};
const scaleCssLength = (value, factor) => String(value || '').replace(/([0-9]*\.?[0-9]+)(rem|px|vw)/g, (_, amount, unit) => {
  const scaled = Number.parseFloat(amount) * factor;
  return (Number.isInteger(scaled) ? scaled : Number(scaled.toFixed(3))) + unit;
});
const generateClamp = (minRem, maxRem, minVw = 320, maxVw = 1280) => {
  const minVal = parseFloat(minRem);
  const maxVal = parseFloat(maxRem);
  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal) || minVal <= 0 || maxVal <= 0) return '';
  const slope = ((maxVal - minVal) / ((maxVw - minVw) / 100)).toFixed(4);
  const intercept = (minVal - (slope * minVw) / 100).toFixed(4);
  return `clamp(${minVal}rem, ${intercept}rem + ${slope}vw, ${maxVal}rem)`;
};
const buildVariationSettingsFromAxes = (axes = {}) => {
  const parts = [];
  Object.entries(axes).forEach(([tag, config]) => {
    if (config && config.enabled !== false && config.value !== undefined) {
      parts.push(`"${tag}" ${config.value}`);
    }
  });
  return parts.length ? parts.join(', ') : 'normal';
};
const quoteFont = (name) => String(name || '').trim() ? '"' + String(name).trim() + '"' : '';
const getCustomFonts = (t = {}) => t.customFonts && typeof t.customFonts === 'object' ? t.customFonts : {};
const getTypographyScale = (t = {}) => {
  const config = t.typographyScale && typeof t.typographyScale === 'object' ? t.typographyScale : {};
  const preset = config.preset === 'custom' ? TYPOGRAPHY_SCALE_PRESETS.default : (TYPOGRAPHY_SCALE_PRESETS[config.preset] || TYPOGRAPHY_SCALE_PRESETS.default);
  const useFluid = config.fluid !== false;
  const base = useFluid ? { ...preset, ...(preset.fluid || {}) } : preset;
  const fluidConfig = config.fluidConfig && typeof config.fluidConfig === 'object' ? config.fluidConfig : {};
  const minVw = numeric(fluidConfig.minVw, 320);
  const maxVw = numeric(fluidConfig.maxVw, 1280);
  const customFluid = config.preset === 'custom' && useFluid;
  return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body1', 'body2'].reduce((acc, key) => {
    if (customFluid && fluidConfig[key + 'Min'] && fluidConfig[key + 'Max']) {
      acc[key] = generateClamp(fluidConfig[key + 'Min'], fluidConfig[key + 'Max'], minVw, maxVw);
    } else {
      acc[key] = cssValue(config[key], base[key] || TYPOGRAPHY_SCALE_PRESETS.default[key]);
    }
    return acc;
  }, { preset: config.preset || 'default', fluid: useFluid });
};
const getFontStacks = (t = {}) => {
  const customFonts = getCustomFonts(t);
  const bodyName = customFonts.bodyUrl ? (customFonts.bodyFamily || 'Storefront Body Custom') : t.fontFamily;
  const headingName = customFonts.headingUrl ? (customFonts.headingFamily || 'Storefront Heading Custom') : (t.headingFont || bodyName);
  const body = bodyName ? quoteFont(bodyName) + ', "Roboto", "Helvetica", "Arial", sans-serif' : '"Roboto", "Helvetica", "Arial", sans-serif';
  const heading = headingName ? quoteFont(headingName) + ', "Roboto", sans-serif' : (bodyName ? body : 'inherit');
  return { body, heading, customFonts };
};
const getMobileOverrides = (t = {}) => t.mobileOverrides && typeof t.mobileOverrides === 'object' ? t.mobileOverrides : {};
const buildFontFaceStyles = (t = {}) => {
  const { customFonts } = getFontStacks(t);
  const faces = [];
  if (customFonts.bodyUrl) faces.push({ fontFamily: customFonts.bodyFamily || 'Storefront Body Custom', src: 'url("' + customFonts.bodyUrl + '") format("' + (customFonts.bodyFormat || 'woff2') + '")', fontWeight: customFonts.bodyWeightRange || '100 900', fontDisplay: 'swap' });
  if (customFonts.headingUrl) faces.push({ fontFamily: customFonts.headingFamily || 'Storefront Heading Custom', src: 'url("' + customFonts.headingUrl + '") format("' + (customFonts.headingFormat || 'woff2') + '")', fontWeight: customFonts.headingWeightRange || '100 900', fontDisplay: 'swap' });
  return faces;
};

export const resolveStorefrontThemeState = (themeSettings = {}, customerDarkMode = null) => {
  const t = themeSettings || {};
  const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const themeMode = customerDarkMode || t.mode || (prefersDark ? 'dark' : 'light');
  const isDark = themeMode === 'dark';
  const fallbackPrimary = isDark ? '#4fd1a5' : '#0f766e';
  const fallbackSecondary = isDark ? '#ffb86b' : '#f97316';
  const fallbackBackground = isDark ? '#101514' : '#f7f3ec';
  const fallbackSurface = isDark ? '#17211f' : '#fffaf2';
  const fallbackText = isDark ? '#f8fafc' : '#1f2933';
  // Always honor admin-configured colors. The darkPalette object (if provided)
  // is layered on top in dark mode. Previously a useAdminColors flag dropped
  // admin colors whenever a customer toggled to a mode that did not match the
  // admin's configured mode — see issue H1 in docs/DESIGN-SYSTEM-ISSUES.md.
  // Dark palette: admin-configured colors for dark mode override
  const dp = isDark && t.darkPalette ? t.darkPalette : null;

  return {
    t,
    themeMode,
    isDark,
    radius: parseInt(t.borderRadius, 10) || 8,
    backgroundStyle: t.backgroundStyle || 'softGradient',
    buttonStyle: t.buttonStyle || 'solid',
    cardStyle: t.cardStyle || 'elevated',
    primaryMain:    dp?.primaryColor    || t.primaryColor    || fallbackPrimary,
    secondaryMain:  dp?.secondaryColor  || t.secondaryColor  || fallbackSecondary,
    backgroundDefault: dp?.backgroundColor || t.backgroundColor || fallbackBackground,
    surfaceColor:   dp?.surfaceColor    || t.surfaceColor    || fallbackSurface,
    textColor:      dp?.textColor       || t.textColor       || fallbackText,
    errorColor:     dp?.errorColor      || t.errorColor      || '#e11d48',
    warningColor:   dp?.warningColor    || t.warningColor    || '#d97706',
    successColor:   dp?.successColor    || t.successColor    || '#059669',
    infoColor:      dp?.infoColor       || t.infoColor       || '#0284c7',
  };
};

const resolveComponentRadius = (option, globalRadius, fallbackOffset = 0) => {
  if (option === 'none') return '0px';
  if (option === 'small') return `${Math.max(globalRadius - 4, 2)}px`;
  if (option === 'medium') return `${globalRadius}px`;
  if (option === 'large') return `${globalRadius + 4}px`;
  if (option === 'pill' || option === 'full') return '9999px';
  
  if (typeof option === 'string' && (option.endsWith('px') || option.endsWith('rem') || option.endsWith('%'))) {
    return option;
  }
  if (typeof option === 'number') {
    return `${option}px`;
  }
  return `${globalRadius + fallbackOffset}px`;
};

const resolveComponentShadow = (option, isDark) => {
  if (option === 'none') return 'none';
  if (option === 'soft') {
    return isDark ? '0 12px 28px rgba(0, 0, 0, 0.20)' : '0 4px 14px rgba(15, 23, 42, 0.08)';
  }
  if (option === 'medium') {
    return isDark ? '0 18px 38px rgba(0, 0, 0, 0.26)' : '0 10px 28px rgba(15, 23, 42, 0.12)';
  }
  if (option === 'strong') {
    return isDark ? '0 24px 56px rgba(0, 0, 0, 0.34)' : '0 18px 44px rgba(15, 23, 42, 0.18)';
  }
  return null;
};

const getCardShadowFallback = (cardStyle, isDark) => {
  if (cardStyle === 'elevated') {
    return isDark ? '0 18px 45px rgba(0, 0, 0, 0.22)' : '0 18px 45px rgba(31, 41, 51, 0.08)';
  }
  return 'none';
};

const resolveCardShadow = (option, cardStyle, isDark) => {
  const resolved = resolveComponentShadow(option, isDark);
  if (resolved !== null) return resolved;
  return getCardShadowFallback(cardStyle, isDark);
};

export const buildStorefrontCssVariables = (settingsOrTheme = {}, customerDarkMode = null) => {
  const safeSettings = settingsOrTheme || {};
  const themeSettings = safeSettings.theme || safeSettings || {};
  const componentStyles = safeSettings.componentStyles || {};

  const {
    themeMode,
    isDark,
    radius,
    backgroundStyle,
    buttonStyle,
    cardStyle,
    primaryMain,
    secondaryMain,
    backgroundDefault,
    surfaceColor,
    textColor,
    errorColor,
    warningColor,
    successColor,
    infoColor,
    t,
  } = resolveStorefrontThemeState(themeSettings, customerDarkMode);

  // Derived color scale — mirrors the values computed in buildStorefrontTheme() palette
  // so MUI and CSS vars are always in sync.
  const primaryDark   = isDark ? '#31a884' : '#0b4f49';
  const primaryLight  = isDark ? '#7ee5c4' : '#ccfbf1';
  const secondaryDark = isDark ? '#f59e0b' : '#c2410c';
  const secondaryLight= isDark ? '#ffd39a' : '#fed7aa';
  const onSecondary   = isDark ? '#1f2933' : '#ffffff';
  const textMuted     = isDark ? '#cbd5e1' : '#64748b';
  const textDisabled  = isDark ? '#475569' : '#94a3b8';
  const typeScale     = getTypographyScale(t);
  const fontStacks    = getFontStacks(t);
  const mobile        = getMobileOverrides(t);
  const divider       = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(15, 118, 110, 0.14)';

  // State colors — derived from primary for hover/active/focus interactions
  const primaryHover  = isDark ? '#3fc49e' : '#0d6b63';
  const primaryActive = isDark ? '#2a9e7d' : '#094844';
  const surfaceHover  = isDark ? 'rgba(79, 209, 165, 0.08)' : 'rgba(15, 118, 110, 0.06)';
  const surfaceActive = isDark ? 'rgba(79, 209, 165, 0.14)' : 'rgba(15, 118, 110, 0.10)';

  const productCardStyles = componentStyles.productCard || {};
  const categoryCardStyles = componentStyles.categoryCard || {};
  const promoCardStyles = componentStyles.promoCard || {};
  const brandCardStyles = componentStyles.brandCard || {};
  const trustCardStyles = componentStyles.trustCard || {};
  const reviewCardStyles = componentStyles.reviewCard || {};
  const contentCardStyles = componentStyles.contentCard || {};
  const cartItemStyles = componentStyles.cartItem || {};
  const checkoutBlockStyles = componentStyles.checkoutBlock || {};
  const formControlStyles = componentStyles.formControl || {};
  const badgeChipStyles = componentStyles.badgeChip || {};

  const productCardRadiusVal = resolveComponentRadius(productCardStyles.radius, radius, 4);
  const categoryCardRadiusVal = resolveComponentRadius(categoryCardStyles.radius, radius, 4);
  const promoCardRadiusVal = resolveComponentRadius(promoCardStyles.radius, radius, 4);
  const brandCardRadiusVal = resolveComponentRadius(brandCardStyles.radius, radius, 4);
  const trustCardRadiusVal = resolveComponentRadius(trustCardStyles.radius, radius, 4);
  const reviewCardRadiusVal = resolveComponentRadius(reviewCardStyles.radius, radius, 4);
  const contentCardRadiusVal = resolveComponentRadius(contentCardStyles.radius, radius, 4);
  const cartItemRadiusVal = resolveComponentRadius(cartItemStyles.radius, radius, 4);
  const checkoutBlockRadiusVal = resolveComponentRadius(checkoutBlockStyles.radius, radius, 4);
  const formControlRadiusVal = resolveComponentRadius(formControlStyles.radius, radius, 0);
  const badgeChipRadiusVal = resolveComponentRadius(badgeChipStyles.radius, radius, 0);

  const productCardShadowVal = resolveCardShadow(productCardStyles.shadow, cardStyle, isDark);
  const categoryCardShadowVal = resolveCardShadow(categoryCardStyles.shadow, cardStyle, isDark);
  const promoCardShadowVal = resolveCardShadow(promoCardStyles.shadow, cardStyle, isDark);
  const brandCardShadowVal = resolveCardShadow(brandCardStyles.shadow, cardStyle, isDark);
  const trustCardShadowVal = resolveCardShadow(trustCardStyles.shadow, cardStyle, isDark);
  const reviewCardShadowVal = resolveCardShadow(reviewCardStyles.shadow, cardStyle, isDark);
  const contentCardShadowVal = resolveCardShadow(contentCardStyles.shadow, cardStyle, isDark);
  const cartItemShadowVal = resolveCardShadow(cartItemStyles.shadow, cardStyle, isDark);
  const checkoutBlockShadowVal = resolveCardShadow(checkoutBlockStyles.shadow, cardStyle, isDark);

  let buttonRadiusVal = `${radius}px`;
  if (buttonStyle === 'pill') {
    buttonRadiusVal = '9999px';
  } else if (checkoutBlockStyles.ctaStyle === 'pill') {
    buttonRadiusVal = '9999px';
  }

  return {
    // ─── Core brand colors ───────────────────────────────────────────────────
    '--store-theme-mode':     themeMode,
    '--store-color-primary':  primaryMain,
    '--store-color-secondary':secondaryMain,
    '--store-color-background':backgroundDefault,
    '--store-color-surface':  surfaceColor,
    '--store-color-text':     textColor,
    '--store-color-text-muted':   textMuted,
    '--store-color-text-disabled': textDisabled,
    '--store-color-divider':      divider,
    '--store-color-border':       divider,   // semantic alias — same value, different intent

    // ─── Derived color scale (dark / light / on-* variants) ─────────────────
    // Enables: var(--store-color-primary-dark) in custom CSS / widgets
    '--store-color-primary-dark':    primaryDark,
    '--store-color-primary-light':   primaryLight,
    '--store-color-on-primary':      '#ffffff',
    '--store-color-secondary-dark':  secondaryDark,
    '--store-color-secondary-light': secondaryLight,
    '--store-color-on-secondary':    onSecondary,
    '--store-color-on-surface':      textColor,
    '--store-color-on-surface-secondary': textMuted,

    // ─── Semantic / state colors ─────────────────────────────────────────────
    // These match the MUI palette (error/warning/success/info) so widgets can
    // use var(--store-color-success) instead of hardcoding hex.
    '--store-color-error':   errorColor,
    '--store-color-warning': warningColor,
    '--store-color-success': successColor,
    '--store-color-info':    infoColor,

    // ─── Interaction state tokens ─────────────────────────────────────────────
    // Hover / active / focus variants for primary and surface colours.
    // Use these in custom CSS: a:hover { color: var(--store-color-primary-hover) }
    '--store-color-primary-hover':  primaryHover,
    '--store-color-primary-active': primaryActive,
    '--store-color-surface-hover':  surfaceHover,
    '--store-color-surface-active': surfaceActive,
    '--store-color-overlay':        isDark ? 'rgba(0, 0, 0, 0.56)' : 'rgba(0, 0, 0, 0.32)',
    '--store-color-scrim':          isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(0, 0, 0, 0.48)',

    // ─── Shape scale ─────────────────────────────────────────────────────────
    // Full semantic radius scale derived from the admin-configured borderRadius.
    '--store-radius-sm':     `${Math.max(radius - 4, 2)}px`,
    '--store-radius-md':     `${radius}px`,           // alias for --store-radius
    '--store-radius':        `${radius}px`,
    '--store-radius-lg':     `${radius + 4}px`,       // alias for --store-radius-card
    '--store-radius-card':   productCardRadiusVal,
    '--store-radius-xl':     `${radius + 8}px`,
    '--store-radius-full':   '9999px',
    '--store-radius-button': buttonRadiusVal,
    '--store-radius-input':  formControlRadiusVal,
    '--store-radius-chip':   badgeChipRadiusVal,
    '--store-radius-badge':  badgeChipRadiusVal,

    // ─── Shadow tokens ────────────────────────────────────────────────────────
    // Mirrors MuiCard boxShadow values so custom CSS stays in sync.
    '--store-shadow-card':     productCardShadowVal,
    '--store-shadow-soft':     isDark ? '0 12px 28px rgba(0, 0, 0, 0.20)'    : '0 4px 14px rgba(15, 23, 42, 0.08)',
    '--store-shadow-medium':   isDark ? '0 18px 38px rgba(0, 0, 0, 0.26)'    : '0 10px 28px rgba(15, 23, 42, 0.12)',
    '--store-shadow-strong':   isDark ? '0 24px 56px rgba(0, 0, 0, 0.34)'    : '0 18px 44px rgba(15, 23, 42, 0.18)',
    '--store-shadow-hover':    isDark ? '0 18px 40px rgba(0, 0, 0, 0.30)'    : '0 12px 28px rgba(15, 23, 42, 0.13)',
    '--store-shadow-dropdown': isDark ? '0 12px 32px rgba(0, 0, 0, 0.28)'    : '0 12px 32px rgba(31, 41, 51, 0.12)',
    '--store-shadow-none':     'none',
    '--store-focus-ring':      `0 0 0 3px color-mix(in srgb, ${primaryMain} 18%, transparent)`,
    '--store-overlay-dark':    'rgba(15, 23, 42, 0.72)',

    // ─── Typography ──────────────────────────────────────────────────────────
    '--store-font-body':    fontStacks.body,
    '--store-font-heading': fontStacks.heading,
    '--store-font-weight-body':    String(t.bodyWeight    ? parseInt(t.bodyWeight, 10)    : 400),
    '--store-font-weight-heading': String(t.headingWeight ? parseInt(t.headingWeight, 10) : 700),
    '--store-font-weight-bold':    '700',
    '--store-font-variation':      t.fontVariationSettings || 'normal',
    '--store-font-variation-body': t.fontVariationSettings || buildVariationSettingsFromAxes(t.variableFontAxes) || 'normal',
    '--store-font-variation-heading': t.fontVariationSettings || buildVariationSettingsFromAxes(t.variableFontAxes) || 'normal',
    '--store-type-scale':          typeScale.preset,
    '--store-font-size-h1':        typeScale.h1,
    '--store-font-size-h2':        typeScale.h2,
    '--store-font-size-h3':        typeScale.h3,
    '--store-font-size-h4':        typeScale.h4,
    '--store-font-size-h5':        typeScale.h5,
    '--store-font-size-h6':        typeScale.h6,
    '--store-font-size-body':      typeScale.body1,
    '--store-font-size-small':     typeScale.body2,
    '--store-line-height':             String(t.lineHeight || 1.5),
    '--store-line-height-tight':       '1.25',
    '--store-line-height-relaxed':     '1.75',
    '--store-line-height-h1':          String(t.lineHeightH1 || t.lineHeight || 1.2),
    '--store-line-height-h2':          String(t.lineHeightH2 || t.lineHeight || 1.25),
    '--store-line-height-h3':          String(t.lineHeightH3 || t.lineHeight || 1.3),
    '--store-line-height-h4':          String(t.lineHeightH4 || t.lineHeight || 1.35),
    '--store-line-height-h5':          String(t.lineHeightH5 || t.lineHeight || 1.4),
    '--store-line-height-h6':          String(t.lineHeightH6 || t.lineHeight || 1.4),
    '--store-letter-spacing':          t.letterSpacing        || '0px',
    '--store-heading-letter-spacing':  t.headingLetterSpacing || '0px',
    '--store-letter-spacing-tight':    '-0.02em',
    '--store-letter-spacing-wide':     '0.04em',
    '--store-mobile-color-primary':    mobile.primaryColor || primaryMain,
    '--store-mobile-color-background': mobile.backgroundColor || backgroundDefault,
    '--store-mobile-color-surface':    mobile.surfaceColor || surfaceColor,
    '--store-mobile-color-text':       mobile.textColor || textColor,
    '--store-mobile-body-font-size':   mobile.bodyFontSize || typeScale.body1,
    '--store-mobile-heading-scale':    String(numeric(mobile.headingScale, 0.88)),
    '--store-mobile-section-padding':  mobile.sectionPadding || '32px',
    '--store-mobile-container-padding':mobile.containerPadding || '16px',

    // ─── Spacing scale (static — not theme-configurable today) ───────────────
    // Enables custom CSS to use var(--store-space-md) instead of magic numbers.
    '--store-space-xs':  '4px',
    '--store-space-sm':  '8px',
    '--store-space-md':  '16px',
    '--store-space-lg':  '24px',
    '--store-space-xl':  '32px',
    '--store-space-2xl': '48px',
    '--store-space-3xl': '64px',

    // ─── Transition tokens (static) ───────────────────────────────────────────
    '--store-transition-fast':    '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    '--store-transition-normal':  '250ms cubic-bezier(0.4, 0, 0.2, 1)',
    '--store-transition-slow':    '350ms cubic-bezier(0.4, 0, 0.2, 1)',
    '--store-ease-in':            'cubic-bezier(0.4, 0, 1, 1)',
    '--store-ease-out':           'cubic-bezier(0, 0, 0.2, 1)',
    '--store-ease-in-out':        'cubic-bezier(0.4, 0, 0.2, 1)',

    // ─── Z-index scale ────────────────────────────────────────────────────────
    // Consistent layering for custom overlays, modals, tooltips.
    '--store-z-dropdown':  '1000',
    '--store-z-sticky':    '1020',
    '--store-z-fixed':     '1030',
    '--store-z-modal':     '1050',
    '--store-z-popover':   '1060',
    '--store-z-tooltip':   '1070',

    // ─── Container / layout tokens ────────────────────────────────────────────
    '--store-container-sm':  '600px',
    '--store-container-md':  '960px',
    '--store-container-lg':  '1280px',
    '--store-container-xl':  '1440px',
    '--store-header-height': '64px',
    '--store-footer-min-height': '200px',

    // ─── Component tokens (shorthand for custom CSS) ──────────────────────────
    // These mirror the Shape + MuiCard/MuiButton overrides so custom CSS
    // can reference them without knowing the admin-configured radius value.
    '--store-button-radius':    buttonRadiusVal,
    '--store-button-padding-x': '20px',
    '--store-button-padding-y': '10px',
    '--store-button-height':    '40px',
    '--store-card-radius':      productCardRadiusVal,
    '--store-card-padding':     '16px',
    '--store-input-radius':     formControlRadiusVal,
    '--store-input-height':     '40px',
    '--store-chip-radius':      badgeChipRadiusVal,
    '--store-chip-height':      '28px',
    '--store-badge-radius':     badgeChipRadiusVal,
    '--store-avatar-radius':    '50%',

    // ─── Component-specific hierarchy tokens ──────────────────────────────────
    '--component-product-card-radius':  productCardRadiusVal,
    '--component-product-card-shadow':  productCardShadowVal,
    '--component-category-card-radius': categoryCardRadiusVal,
    '--component-category-card-shadow': categoryCardShadowVal,
    '--component-promo-card-radius':    promoCardRadiusVal,
    '--component-promo-card-shadow':    promoCardShadowVal,
    '--component-brand-card-radius':    brandCardRadiusVal,
    '--component-brand-card-shadow':    brandCardShadowVal,
    '--component-trust-card-radius':    trustCardRadiusVal,
    '--component-trust-card-shadow':    trustCardShadowVal,
    '--component-review-card-radius':   reviewCardRadiusVal,
    '--component-review-card-shadow':   reviewCardShadowVal,
    '--component-content-card-radius':  contentCardRadiusVal,
    '--component-content-card-shadow':  contentCardShadowVal,
    '--component-cart-item-radius':     cartItemRadiusVal,
    '--component-cart-item-shadow':     cartItemShadowVal,
    '--component-checkout-block-radius': checkoutBlockRadiusVal,
    '--component-checkout-block-shadow': checkoutBlockShadowVal,
    '--component-form-control-radius':   formControlRadiusVal,
    '--component-badge-chip-radius':    badgeChipRadiusVal,

    // ─── Style flags (consumed by storefront components) ─────────────────────
    '--store-style-background': backgroundStyle,
    '--store-style-button':     buttonStyle,
    '--store-style-card':       cardStyle,
  };
};

export const buildCriticalThemeCss = (themeSettings = {}, customerDarkMode = null) => {
  const vars = buildStorefrontCssVariables(themeSettings, customerDarkMode);
  const pick = (key) => vars[key] || '';
  return [
    ':root{',
    '--store-color-primary:' + pick('--store-color-primary') + ';',
    '--store-color-background:' + pick('--store-color-background') + ';',
    '--store-color-surface:' + pick('--store-color-surface') + ';',
    '--store-color-text:' + pick('--store-color-text') + ';',
    '--store-font-body:' + pick('--store-font-body') + ';',
    '--store-font-heading:' + pick('--store-font-heading') + ';',
    '--store-font-size-h1:' + pick('--store-font-size-h1') + ';',
    '--store-font-size-h2:' + pick('--store-font-size-h2') + ';',
    '--store-font-size-body:' + pick('--store-font-size-body') + ';',
    '--store-radius:' + pick('--store-radius') + ';',
    '}',
    'body{margin:0;background:var(--store-color-background);color:var(--store-color-text);font-family:var(--store-font-body);font-size:var(--store-font-size-body);}',
    'h1,h2,h3,h4,h5,h6{font-family:var(--store-font-heading);letter-spacing:var(--store-heading-letter-spacing,0);}',
    '.MuiContainer-root{padding-left:var(--store-container-padding-x,24px);padding-right:var(--store-container-padding-x,24px);}',
    '@media(max-width:600px){body{font-size:var(--store-mobile-body-font-size,var(--store-font-size-body));}.MuiContainer-root{padding-left:var(--store-mobile-container-padding,16px);padding-right:var(--store-mobile-container-padding,16px);}}',
  ].join('');
};

export const buildStorefrontTheme = (themeSettings = {}, customerDarkMode = null) => {
  const {
    t,
    themeMode,
    isDark,
    radius,
    backgroundStyle,
    buttonStyle,
    cardStyle,
    primaryMain,
    secondaryMain,
    backgroundDefault,
    surfaceColor,
    textColor,
    errorColor,
    warningColor,
    successColor,
    infoColor,
  } = resolveStorefrontThemeState(themeSettings, customerDarkMode);

  const typeScale = getTypographyScale(t);
  const fontStacks = getFontStacks(t);
  const mobile = getMobileOverrides(t);
  const fontFaces = buildFontFaceStyles(t);
  const headingBase = {
    fontWeight: t.headingWeight ? parseInt(t.headingWeight, 10) : 700,
    letterSpacing: t.headingLetterSpacing || '0px',
    fontFamily: fontStacks.heading,
    fontVariationSettings: t.fontVariationSettings || buildVariationSettingsFromAxes(t.variableFontAxes) || 'normal',
  };
  const bodyBase = {
    fontWeight: t.bodyWeight ? parseInt(t.bodyWeight, 10) : 400,
    lineHeight: t.lineHeight || 1.5,
    letterSpacing: t.letterSpacing || '0px',
    fontVariationSettings: t.fontVariationSettings || buildVariationSettingsFromAxes(t.variableFontAxes) || 'normal',
  };

  return {
    palette: {
      mode: themeMode,
      primary: {
        main: primaryMain,
        dark: isDark ? '#31a884' : '#0b4f49',
        light: isDark ? '#7ee5c4' : '#ccfbf1',
        contrastText: '#ffffff',
      },
      secondary: {
        main: secondaryMain,
        dark: isDark ? '#f59e0b' : '#c2410c',
        light: isDark ? '#ffd39a' : '#fed7aa',
        contrastText: isDark ? '#1f2933' : '#ffffff',
      },
      error: {
        main: errorColor,
      },
      warning: {
        main: warningColor,
      },
      success: {
        main: successColor,
      },
      info: {
        main: infoColor,
      },
      background: {
        default: backgroundDefault,
        paper: surfaceColor,
      },
      text: {
        primary: textColor,
        secondary: isDark ? '#cbd5e1' : '#64748b',
      },
      divider: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(15, 118, 110, 0.14)',
    },
    typography: {
      fontFamily: fontStacks.body,
      h1: { ...headingBase, fontSize: typeScale.h1, fontWeight: t.headingWeight ? parseInt(t.headingWeight, 10) : 800 },
      h2: { ...headingBase, fontSize: typeScale.h2, fontWeight: t.headingWeight ? parseInt(t.headingWeight, 10) : 800 },
      h3: { ...headingBase, fontSize: typeScale.h3, fontWeight: t.headingWeight ? parseInt(t.headingWeight, 10) : 800 },
      h4: { ...headingBase, fontSize: typeScale.h4, fontWeight: t.headingWeight ? parseInt(t.headingWeight, 10) : 800 },
      h5: { ...headingBase, fontSize: typeScale.h5, fontWeight: t.headingWeight ? parseInt(t.headingWeight, 10) : 800 },
      h6: { ...headingBase, fontSize: typeScale.h6, fontWeight: t.headingWeight ? parseInt(t.headingWeight, 10) : 800 },
      body1: { ...bodyBase, fontSize: typeScale.body1 },
      body2: { ...bodyBase, fontSize: typeScale.body2 },
      button: { textTransform: 'none', fontWeight: 700, fontVariationSettings: t.fontVariationSettings || buildVariationSettingsFromAxes(t.variableFontAxes) || 'normal' },
    },
    shape: {
      borderRadius: radius,
    },
    breakpoints: {
      values: {
        xs: 0,
        sm: 600,
        md: 960,
        lg: 1280,
        xl: 1920,
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: radius,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
          containedPrimary: {
            background: buttonStyle === 'soft' || buttonStyle === 'outline'
              ? 'transparent'
              : `linear-gradient(135deg, ${primaryMain} 0%, ${isDark ? secondaryMain : '#134e4a'} 100%)`,
            color: buttonStyle === 'soft' || buttonStyle === 'outline' ? primaryMain : '#ffffff',
            border: buttonStyle === 'outline' ? `1px solid ${primaryMain}` : '1px solid transparent',
            ...(buttonStyle === 'soft' && { backgroundColor: `${primaryMain}22` }),
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: radius + 4,
            border: cardStyle === 'flat'
              ? '1px solid transparent'
              : `1px solid ${isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(15, 118, 110, 0.12)'}`,
            boxShadow: cardStyle === 'elevated'
              ? (isDark ? '0 18px 45px rgba(0, 0, 0, 0.22)' : '0 18px 45px rgba(31, 41, 51, 0.08)')
              : 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: radius,
            backgroundImage: 'none',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: radius, fontWeight: 700 },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': { borderRadius: radius },
          },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          ...(fontFaces.length ? { '@font-face': fontFaces } : {}),
          ':root': {
            '--store-section-padding-y': 'var(--store-space-3xl)',
            '--store-container-padding-x': 'var(--store-space-lg)',
          },
          body: {
            background:
              backgroundStyle === 'softGradient'
                ? `linear-gradient(180deg, ${backgroundDefault} 0%, ${surfaceColor} 48%, ${backgroundDefault} 100%)`
                : backgroundDefault,
            fontWeight: t.bodyWeight ? parseInt(t.bodyWeight, 10) : 400,
            lineHeight: t.lineHeight || 1.5,
            letterSpacing: t.letterSpacing || '0px',
            fontVariationSettings: t.fontVariationSettings || buildVariationSettingsFromAxes(t.variableFontAxes) || 'normal',
          },
          'h1, h2, h3, h4, h5, h6': {
            fontFamily: fontStacks.heading,
            fontWeight: t.headingWeight ? parseInt(t.headingWeight, 10) : 700,
            letterSpacing: t.headingLetterSpacing || '0px',
            fontVariationSettings: t.fontVariationSettings || buildVariationSettingsFromAxes(t.variableFontAxes) || 'normal',
          },
          '@media (max-width:600px)': {
            ':root': {
              '--store-color-primary': (mobile.primaryColor || primaryMain) + ' !important',
              '--store-color-background': (mobile.backgroundColor || backgroundDefault) + ' !important',
              '--store-color-surface': (mobile.surfaceColor || surfaceColor) + ' !important',
              '--store-color-text': (mobile.textColor || textColor) + ' !important',
              '--store-section-padding-y': mobile.sectionPadding || '32px',
              '--store-container-padding-x': mobile.containerPadding || '16px',
            },
            body: {
              background: mobile.backgroundColor || backgroundDefault,
              color: mobile.textColor || textColor,
              fontSize: mobile.bodyFontSize || typeScale.body1,
            },
            'h1, .MuiTypography-h1': { fontSize: scaleCssLength(typeScale.h1, numeric(mobile.headingScale, 0.88)) },
            'h2, .MuiTypography-h2': { fontSize: scaleCssLength(typeScale.h2, numeric(mobile.headingScale, 0.88)) },
            'h3, .MuiTypography-h3': { fontSize: scaleCssLength(typeScale.h3, numeric(mobile.headingScale, 0.88)) },
            'h4, .MuiTypography-h4': { fontSize: scaleCssLength(typeScale.h4, numeric(mobile.headingScale, 0.88)) },
            'h5, .MuiTypography-h5': { fontSize: scaleCssLength(typeScale.h5, numeric(mobile.headingScale, 0.88)) },
            '.MuiContainer-root': { paddingLeft: mobile.containerPadding || '16px', paddingRight: mobile.containerPadding || '16px' },
          },
        },
      },
    },
  };
};
