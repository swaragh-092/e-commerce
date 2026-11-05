/**
 * designTokens.js
 *
 * Single source of truth for storefront design tokens.
 *
 * Everything that renders storefront UI — MUI's theme, CSS custom properties,
 * the Store Designer previews, and the token editor's button matrix — reads
 * from `resolveDesignTokens()`. This keeps the preview and the real storefront
 * in sync and means brand interaction colours are derived from the merchant's
 * selected colours instead of being hardcoded.
 *
 * Colour math is deliberately dependency-free and pure so it can run in the
 * browser, in tests, and inside the editor without touching the DOM.
 */

import { contrastRatio, hexToRgb } from './accessibility';

export const SAFETY_RED = '#dc3545';
export const SAFETY_RED_HOVER = '#b91c1c';

export const BUTTON_ROLES = ['primary', 'secondary', 'neutral', 'success', 'warning', 'danger', 'info'];
export const BUTTON_APPEARANCES = ['solid', 'soft', 'outlined', 'text'];
export const BUTTON_STATES = ['default', 'hover', 'pressed', 'focus', 'disabled', 'loading'];

const DEFAULT_COLORS = {
  light: {
    primary: '#0f766e',
    secondary: '#f97316',
    background: '#f7f3ec',
    surface: '#fffaf2',
    text: '#1f2933',
    error: '#dc3545',
    warning: '#d97706',
    success: '#059669',
    info: '#0284c7',
  },
  dark: {
    primary: '#4fd1a5',
    secondary: '#ffb86b',
    background: '#101514',
    surface: '#17211f',
    text: '#f8fafc',
    error: '#dc3545',
    warning: '#d97706',
    success: '#059669',
    info: '#0284c7',
  },
};

const FALLBACK_TEXT_LIGHT = '#111827';
const FALLBACK_TEXT_DARK = '#ffffff';

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const parseColor = (value) => {
  if (!value || typeof value !== 'string') return null;
  const rgb = hexToRgb(value);
  if (rgb) return rgb;
  const match = value.match(/^rgba?\(\s*([0-9.]+)\s*[, ]\s*([0-9.]+)\s*[, ]\s*([0-9.]+)/i);
  if (!match) return null;
  return [Math.round(Number(match[1])), Math.round(Number(match[2])), Math.round(Number(match[3]))];
};

const toHex = ([r, g, b]) => (
  '#' + [r, g, b].map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')).join('')
);

export const mixColor = (from, to, weight = 0.5) => {
  const a = parseColor(from);
  const b = parseColor(to);
  if (!a || !b) return from;
  const amount = clamp(weight);
  return toHex([
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ]);
};

export const withAlpha = (color, alpha = 0.5) => {
  const rgb = parseColor(color);
  if (!rgb) return color;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clamp(alpha)})`;
};

export const readableForeground = (background, options = {}) => {
  const { light = FALLBACK_TEXT_DARK, dark = FALLBACK_TEXT_LIGHT, target = 4.5 } = options;
  const best = [light, dark]
    .map((color) => ({ color, ratio: contrastRatio(color, background) ?? 0 }))
    .reduce((winner, candidate) => candidate.ratio > winner.ratio ? candidate : winner, { color: light, ratio: 0 });
  if (best.ratio >= target) return best.color;

  const whiteRatio = contrastRatio('#ffffff', background) ?? 0;
  const blackRatio = contrastRatio('#000000', background) ?? 0;
  return whiteRatio >= blackRatio ? '#ffffff' : '#000000';
};

/**
 * Nudge a foreground colour toward black or white until it meets the target
 * contrast against a surface. Used for soft/outlined/text buttons where the
 * brand colour itself may be too light for normal-sized text.
 */
export const ensureContrast = (foreground, background, target = 4.5) => {
  const initial = parseColor(foreground);
  const surface = parseColor(background);
  if (!initial || !surface) return foreground;
  if ((contrastRatio(foreground, background) ?? 0) >= target) return foreground;

  const surfaceLuminance = (contrastRatio('#ffffff', background) ?? 0) > (contrastRatio('#000000', background) ?? 0);
  const pole = surfaceLuminance ? '#ffffff' : '#000000';
  let best = foreground;
  let bestRatio = contrastRatio(foreground, background) ?? 0;
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mixColor(foreground, pole, step / 20);
    const ratio = contrastRatio(candidate, background) ?? 0;
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
    if (ratio >= target) return candidate;
  }
  return best;
};

const shiftColor = (base, isDark, amount) => {
  const pole = isDark ? '#ffffff' : '#000000';
  return mixColor(base, pole, amount);
};

const createStateSet = (base, foreground, border, options = {}) => {
  const { isDark, surface, focusColor = base } = options;
  const hoverBg = shiftColor(base, isDark, 0.14);
  const pressedBg = shiftColor(base, isDark, 0.24);
  const resolvedBorder = border || 'transparent';
  const focusRing = `0 0 0 3px ${withAlpha(focusColor, 0.4)}`;
  return {
    default: { bg: base, fg: foreground, border: resolvedBorder },
    hover: {
      bg: hoverBg,
      fg: readableForeground(hoverBg),
      border: resolvedBorder,
    },
    pressed: {
      bg: pressedBg,
      fg: readableForeground(pressedBg),
      border: resolvedBorder,
    },
    focus: { bg: base, fg: foreground, border: resolvedBorder, ring: focusRing },
    disabled: {
      bg: mixColor(base, surface, 0.74),
      fg: ensureContrast(mixColor(foreground, surface, 0.35), mixColor(base, surface, 0.74), 3),
      border: mixColor(resolvedBorder === 'transparent' ? base : resolvedBorder, surface, 0.6),
    },
    loading: { bg: base, fg: foreground, border: resolvedBorder },
  };
};

const createTintedStateSet = (accent, surface, isDark, options = {}) => {
  const { borderAccent = false, transparent = false, preserveAccent = false } = options;
  const bgSurface = transparent ? surface : mixColor(accent, surface, isDark ? 0.8 : 0.88);
  const baseBg = transparent ? 'transparent' : bgSurface;
  const resolveFg = (background) => (preserveAccent ? accent : ensureContrast(accent, background, 4.5));
  const baseFg = resolveFg(bgSurface);
  const hoverBg = transparent
    ? withAlpha(accent, isDark ? 0.16 : 0.1)
    : mixColor(accent, surface, isDark ? 0.72 : 0.8);
  const pressedBg = transparent
    ? withAlpha(accent, isDark ? 0.24 : 0.16)
    : mixColor(accent, surface, isDark ? 0.64 : 0.72);
  const border = borderAccent
    ? ensureContrast(accent, surface, 3)
    : (transparent ? 'transparent' : withAlpha(accent, 0.24));
  return {
    default: { bg: baseBg, fg: baseFg, border },
    hover: {
      bg: hoverBg,
      fg: resolveFg(transparent ? surface : hoverBg),
      border,
    },
    pressed: {
      bg: pressedBg,
      fg: resolveFg(transparent ? surface : pressedBg),
      border,
    },
    focus: {
      bg: baseBg,
      fg: baseFg,
      border,
      ring: `0 0 0 3px ${withAlpha(accent, 0.4)}`,
    },
    disabled: {
      bg: transparent ? 'transparent' : mixColor(surface, accent, 0.06),
      fg: mixColor(resolveFg(surface), surface, 0.55),
      border: mixColor(border === 'transparent' ? accent : border, surface, 0.65),
    },
    loading: { bg: baseBg, fg: baseFg, border },
  };
};

const createRoleAppearances = (accent, surface, isDark, options = {}) => {
  const {
    solidAccent = accent,
    solidForeground,
    solidBorder = 'transparent',
    outlinedAccent = accent,
    preserveTintedAccent = false,
  } = options;
  const solidFg = solidForeground || readableForeground(solidAccent);
  const tintedOptions = { preserveAccent: preserveTintedAccent };
  return {
    solid: createStateSet(solidAccent, solidFg, solidBorder, { isDark, surface, focusColor: solidAccent }),
    soft: createTintedStateSet(accent, surface, isDark, tintedOptions),
    outlined: createTintedStateSet(outlinedAccent, surface, isDark, { ...tintedOptions, borderAccent: true, transparent: true }),
    text: createTintedStateSet(
      preserveTintedAccent ? accent : ensureContrast(accent, surface, 4.5),
      surface,
      isDark,
      { ...tintedOptions, transparent: true }
    ),
  };
};

const createOnImageAppearances = (tokens) => {
  const solid = tokens.buttons.primary.solid;
  const solidOverlay = {
    ...solid,
    default: { ...solid.default, border: 'rgba(255, 255, 255, 0.28)' },
    hover: { ...solid.hover, border: 'rgba(255, 255, 255, 0.4)' },
    pressed: { ...solid.pressed, border: 'rgba(255, 255, 255, 0.4)' },
    focus: { ...solid.focus, border: 'rgba(255, 255, 255, 0.4)', ring: '0 0 0 3px rgba(255, 255, 255, 0.5)' },
    disabled: { ...solid.disabled, border: 'rgba(255, 255, 255, 0.18)' },
    loading: { ...solid.loading, border: 'rgba(255, 255, 255, 0.28)' },
  };
  const softBg = mixColor(tokens.colors.primary, '#0f172a', 0.18);
  const soft = {
    default: { bg: withAlpha(softBg, 0.9), fg: readableForeground(softBg), border: 'rgba(255, 255, 255, 0.22)' },
    hover: { bg: withAlpha(shiftColor(softBg, true, 0.1), 0.94), fg: readableForeground(shiftColor(softBg, true, 0.1)), border: 'rgba(255, 255, 255, 0.32)' },
    pressed: { bg: withAlpha(shiftColor(softBg, true, 0.18), 0.96), fg: readableForeground(shiftColor(softBg, true, 0.18)), border: 'rgba(255, 255, 255, 0.32)' },
    focus: { bg: withAlpha(softBg, 0.9), fg: readableForeground(softBg), border: 'rgba(255, 255, 255, 0.32)', ring: '0 0 0 3px rgba(255, 255, 255, 0.5)' },
    disabled: { bg: withAlpha(softBg, 0.45), fg: 'rgba(255, 255, 255, 0.62)', border: 'rgba(255, 255, 255, 0.16)' },
    loading: { bg: withAlpha(softBg, 0.9), fg: readableForeground(softBg), border: 'rgba(255, 255, 255, 0.22)' },
  };
  const outlinedFg = '#ffffff';
  const outlined = {
    default: { bg: 'rgba(15, 23, 42, 0.34)', fg: outlinedFg, border: 'rgba(255, 255, 255, 0.72)' },
    hover: { bg: 'rgba(15, 23, 42, 0.5)', fg: outlinedFg, border: 'rgba(255, 255, 255, 0.9)' },
    pressed: { bg: 'rgba(15, 23, 42, 0.62)', fg: outlinedFg, border: 'rgba(255, 255, 255, 0.9)' },
    focus: { bg: 'rgba(15, 23, 42, 0.34)', fg: outlinedFg, border: 'rgba(255, 255, 255, 0.9)', ring: '0 0 0 3px rgba(255, 255, 255, 0.5)' },
    disabled: { bg: 'rgba(15, 23, 42, 0.2)', fg: 'rgba(255, 255, 255, 0.6)', border: 'rgba(255, 255, 255, 0.28)' },
    loading: { bg: 'rgba(15, 23, 42, 0.34)', fg: outlinedFg, border: 'rgba(255, 255, 255, 0.72)' },
  };
  const text = {
    default: { bg: 'transparent', fg: outlinedFg, border: 'transparent' },
    hover: { bg: 'rgba(255, 255, 255, 0.16)', fg: outlinedFg, border: 'transparent' },
    pressed: { bg: 'rgba(255, 255, 255, 0.24)', fg: outlinedFg, border: 'transparent' },
    focus: { bg: 'transparent', fg: outlinedFg, border: 'transparent', ring: '0 0 0 3px rgba(255, 255, 255, 0.5)' },
    disabled: { bg: 'transparent', fg: 'rgba(255, 255, 255, 0.6)', border: 'transparent' },
    loading: { bg: 'transparent', fg: outlinedFg, border: 'transparent' },
  };
  return { solid: solidOverlay, soft, outlined, text };
};

export const getLegacyButtonAppearance = (buttonStyle = 'solid') => {
  if (buttonStyle === 'outline') return 'outlined';
  if (buttonStyle === 'soft') return 'soft';
  return 'solid';
};

/**
 * Resolve the full storefront token object for a theme + colour mode.
 */
export const resolveDesignTokens = (themeSettings = {}, customerDarkMode = null) => {
  const t = themeSettings || {};
  const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const themeMode = customerDarkMode || t.mode || (prefersDark ? 'dark' : 'light');
  const isDark = themeMode === 'dark';
  const defaults = isDark ? DEFAULT_COLORS.dark : DEFAULT_COLORS.light;
  const darkPalette = isDark && t.darkPalette && typeof t.darkPalette === 'object' ? t.darkPalette : {};

  const primary = darkPalette.primaryColor || t.primaryColor || defaults.primary;
  const secondary = darkPalette.secondaryColor || t.secondaryColor || defaults.secondary;
  const background = darkPalette.backgroundColor || t.backgroundColor || defaults.background;
  const surface = darkPalette.surfaceColor || t.surfaceColor || defaults.surface;
  const text = darkPalette.textColor || t.textColor || defaults.text;
  const error = darkPalette.errorColor || t.errorColor || defaults.error;
  const cancel = darkPalette.cancelButtonColor || t.cancelButtonColor || SAFETY_RED;
  const warning = darkPalette.warningColor || t.warningColor || defaults.warning;
  const success = darkPalette.successColor || t.successColor || defaults.success;
  const info = darkPalette.infoColor || t.infoColor || defaults.info;

  const textMuted = mixColor(text, background, isDark ? 0.28 : 0.42);
  const textDisabled = mixColor(text, background, isDark ? 0.5 : 0.58);
  const divider = withAlpha(text, isDark ? 0.18 : 0.14);
  const neutralSolidBg = mixColor(surface, text, isDark ? 0.18 : 0.08);
  const neutralSolidFg = ensureContrast(text, neutralSolidBg, 4.5);

  const primaryHover = shiftColor(primary, isDark, 0.14);
  const primaryPressed = shiftColor(primary, isDark, 0.24);
  const secondaryHover = shiftColor(secondary, isDark, 0.14);
  const secondaryPressed = shiftColor(secondary, isDark, 0.24);
  const errorHover = shiftColor(error, isDark, 0.14);
  const errorPressed = shiftColor(error, isDark, 0.24);
  const warningHover = shiftColor(warning, isDark, 0.14);
  const warningPressed = shiftColor(warning, isDark, 0.24);
  const successHover = shiftColor(success, isDark, 0.14);
  const successPressed = shiftColor(success, isDark, 0.24);
  const infoHover = shiftColor(info, isDark, 0.14);
  const infoPressed = shiftColor(info, isDark, 0.24);

  const colors = {
    mode: themeMode,
    isDark,
    primary,
    secondary,
    background,
    surface,
    text,
    textMuted,
    textDisabled,
    divider,
    neutral: neutralSolidBg,
    neutralText: neutralSolidFg,
    error,
    cancel,
    warning,
    success,
    info,
    danger: SAFETY_RED,
    onPrimary: readableForeground(primary),
    onSecondary: readableForeground(secondary),
    onNeutral: neutralSolidFg,
    onError: readableForeground(error),
    onWarning: readableForeground(warning),
    onSuccess: readableForeground(success),
    onInfo: readableForeground(info),
    onDanger: readableForeground(SAFETY_RED),
    primaryDark: mixColor(primary, '#000000', 0.18),
    primaryLight: mixColor(primary, '#ffffff', 0.7),
    primaryHover,
    primaryPressed,
    secondaryDark: mixColor(secondary, '#000000', 0.18),
    secondaryLight: mixColor(secondary, '#ffffff', 0.7),
    secondaryHover,
    secondaryPressed,
    errorDark: mixColor(error, '#000000', 0.18),
    errorLight: mixColor(error, '#ffffff', 0.7),
    errorHover,
    errorPressed,
    warningDark: mixColor(warning, '#000000', 0.18),
    warningLight: mixColor(warning, '#ffffff', 0.7),
    warningHover,
    warningPressed,
    successDark: mixColor(success, '#000000', 0.18),
    successLight: mixColor(success, '#ffffff', 0.7),
    successHover,
    successPressed,
    infoDark: mixColor(info, '#000000', 0.18),
    infoLight: mixColor(info, '#ffffff', 0.7),
    infoHover,
    infoPressed,
    surfaceHover: withAlpha(primary, isDark ? 0.1 : 0.06),
    surfacePressed: withAlpha(primary, isDark ? 0.16 : 0.1),
    focusRing: `0 0 0 3px ${withAlpha(primary, 0.3)}`,
    overlay: isDark ? 'rgba(0, 0, 0, 0.56)' : 'rgba(0, 0, 0, 0.32)',
    scrim: isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(0, 0, 0, 0.48)',
  };

  const dangerSolid = createStateSet(SAFETY_RED, readableForeground(SAFETY_RED), 'transparent', {
    isDark,
    surface,
    focusColor: SAFETY_RED,
  });
  dangerSolid.hover = {
    ...dangerSolid.hover,
    bg: SAFETY_RED_HOVER,
    fg: readableForeground(SAFETY_RED_HOVER),
  };
  dangerSolid.pressed = {
    ...dangerSolid.pressed,
    bg: mixColor(SAFETY_RED_HOVER, '#000000', 0.12),
    fg: readableForeground(mixColor(SAFETY_RED_HOVER, '#000000', 0.12)),
  };

  const buttons = {
    primary: createRoleAppearances(primary, surface, isDark),
    secondary: createRoleAppearances(neutralSolidBg, surface, isDark, {
      solidAccent: neutralSolidBg,
      solidForeground: neutralSolidFg,
      solidBorder: divider,
      outlinedAccent: text,
    }),
    neutral: createRoleAppearances(neutralSolidBg, surface, isDark, {
      solidAccent: neutralSolidBg,
      solidForeground: neutralSolidFg,
      solidBorder: divider,
      outlinedAccent: text,
    }),
    success: createRoleAppearances(success, surface, isDark),
    warning: createRoleAppearances(warning, surface, isDark),
    danger: {
      ...createRoleAppearances(cancel, surface, isDark, { outlinedAccent: cancel, preserveTintedAccent: true }),
      solid: dangerSolid,
    },
    info: createRoleAppearances(info, surface, isDark),
  };

  const defaultAppearance = {
    primary: getLegacyButtonAppearance(t.buttonStyle || 'solid'),
    secondary: 'outlined',
    neutral: 'text',
    success: 'solid',
    warning: 'solid',
    danger: 'solid',
    info: 'solid',
  };

  const tokens = {
    mode: themeMode,
    isDark,
    theme: t,
    colors,
    buttons,
    // MUI's `color="secondary"` is the brand secondary colour. The new
    // role-based `secondary` entry above is intentionally neutral, so keep
    // the brand version separate for backward compatibility.
    brandSecondary: createRoleAppearances(secondary, surface, isDark),
    defaultAppearance,
    radius: parseInt(t.borderRadius, 10) || 8,
    legacyButtonStyle: t.buttonStyle || 'solid',
    backgroundStyle: t.backgroundStyle || 'softGradient',
    cardStyle: t.cardStyle || 'elevated',
  };
  tokens.onImage = createOnImageAppearances(tokens);
  return tokens;
};

const kebab = (value) => String(value).replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());

export const buildColorCssVariables = (tokens) => {
  const c = tokens.colors;
  const vars = {
    '--store-color-primary': c.primary,
    '--store-color-secondary': c.secondary,
    '--store-color-background': c.background,
    '--store-color-surface': c.surface,
    '--store-color-text': c.text,
    '--store-color-text-muted': c.textMuted,
    '--store-color-text-disabled': c.textDisabled,
    '--store-color-divider': c.divider,
    '--store-color-border': c.divider,

    '--store-color-primary-dark': c.primaryDark,
    '--store-color-primary-light': c.primaryLight,
    '--store-color-primary-hover': c.primaryHover,
    '--store-color-primary-active': c.primaryPressed,
    '--store-color-primary-pressed': c.primaryPressed,
    '--store-color-on-primary': c.onPrimary,

    '--store-color-secondary-dark': c.secondaryDark,
    '--store-color-secondary-light': c.secondaryLight,
    '--store-color-secondary-hover': c.secondaryHover,
    '--store-color-secondary-active': c.secondaryPressed,
    '--store-color-on-secondary': c.onSecondary,

    '--store-color-neutral': c.neutral,
    '--store-color-on-neutral': c.onNeutral,

    '--store-color-error': c.error,
    '--store-color-error-hover': c.errorHover,
    '--store-color-error-active': c.errorPressed,
    '--store-color-on-error': c.onError,
    '--store-color-warning': c.warning,
    '--store-color-warning-hover': c.warningHover,
    '--store-color-warning-active': c.warningPressed,
    '--store-color-on-warning': c.onWarning,
    '--store-color-success': c.success,
    '--store-color-success-hover': c.successHover,
    '--store-color-success-active': c.successPressed,
    '--store-color-on-success': c.onSuccess,
    '--store-color-info': c.info,
    '--store-color-info-hover': c.infoHover,
    '--store-color-info-active': c.infoPressed,
    '--store-color-on-info': c.onInfo,
    '--store-color-danger': c.danger,
    '--store-color-on-danger': c.onDanger,
    '--store-color-cancel': c.cancel,

    '--store-color-on-surface': c.text,
    '--store-color-on-surface-secondary': c.textMuted,
    '--store-color-surface-hover': c.surfaceHover,
    '--store-color-surface-active': c.surfacePressed,
    '--store-color-overlay': c.overlay,
    '--store-color-scrim': c.scrim,
    '--store-focus-ring': c.focusRing,
  };

  const addStateSet = (prefix, states) => {
    vars[`${prefix}-bg`] = states.default.bg;
    vars[`${prefix}-text`] = states.default.fg;
    vars[`${prefix}-fg`] = states.default.fg;
    vars[`${prefix}-border`] = states.default.border;
    vars[`${prefix}-hover-bg`] = states.hover.bg;
    vars[`${prefix}-hover-text`] = states.hover.fg;
    vars[`${prefix}-hover-fg`] = states.hover.fg;
    vars[`${prefix}-hover-border`] = states.hover.border;
    vars[`${prefix}-pressed-bg`] = states.pressed.bg;
    vars[`${prefix}-pressed-text`] = states.pressed.fg;
    vars[`${prefix}-pressed-fg`] = states.pressed.fg;
    vars[`${prefix}-pressed-border`] = states.pressed.border;
    vars[`${prefix}-focus-ring`] = states.focus.ring;
    vars[`${prefix}-disabled-bg`] = states.disabled.bg;
    vars[`${prefix}-disabled-text`] = states.disabled.fg;
    vars[`${prefix}-disabled-fg`] = states.disabled.fg;
    vars[`${prefix}-disabled-border`] = states.disabled.border;
    vars[`${prefix}-loading-bg`] = states.loading.bg;
    vars[`${prefix}-loading-text`] = states.loading.fg;
  };

  Object.entries(tokens.buttons).forEach(([role, appearances]) => {
    Object.entries(appearances).forEach(([appearance, states]) => {
      addStateSet(`--store-btn-${kebab(role)}-${appearance}`, states);
    });
  });
  Object.entries(tokens.brandSecondary).forEach(([appearance, states]) => {
    addStateSet(`--store-btn-brand-secondary-${appearance}`, states);
  });
  Object.entries(tokens.onImage).forEach(([appearance, states]) => {
    addStateSet(`--store-btn-on-image-${appearance}`, states);
  });

  // Legacy aliases kept so existing custom CSS and saved themes continue to work.
  addStateSet('--store-btn-primary', tokens.buttons.primary.solid);
  addStateSet('--store-btn-secondary', tokens.brandSecondary.solid);
  addStateSet('--store-btn-success', tokens.buttons.success.solid);
  addStateSet('--store-btn-warning', tokens.buttons.warning.solid);
  addStateSet('--store-btn-info', tokens.buttons.info.solid);
  addStateSet('--store-btn-danger', tokens.buttons.danger.solid);
  addStateSet('--store-btn-neutral', tokens.buttons.neutral.solid);
  addStateSet(
    '--store-btn-light',
    createStateSet(
      c.isDark ? '#334155' : '#f8fafc',
      c.isDark ? '#f8fafc' : '#1e293b',
      c.isDark ? '#475569' : '#e2e8f0',
      { isDark: c.isDark, surface: c.surface }
    )
  );
  addStateSet(
    '--store-btn-dark',
    createStateSet(
      c.isDark ? '#0f172a' : '#212529',
      '#ffffff',
      c.isDark ? '#1e293b' : '#212529',
      { isDark: c.isDark, surface: c.surface }
    )
  );
  vars['--store-btn-cancel-border'] = c.cancel;
  vars['--store-btn-cancel-text'] = c.cancel;
  vars['--store-btn-danger-hover'] = tokens.buttons.danger.solid.hover.bg;
  return vars;
};

export const buildButtonPalette = (tokens) => {
  const c = tokens.colors;
  return {
    primary: {
      main: c.primary,
      dark: c.primaryDark,
      light: c.primaryLight,
      contrastText: c.onPrimary,
    },
    secondary: {
      main: c.secondary,
      dark: c.secondaryDark,
      light: c.secondaryLight,
      contrastText: c.onSecondary,
    },
    error: {
      main: c.error,
      dark: c.errorDark,
      light: c.errorLight,
      contrastText: c.onError,
    },
    warning: {
      main: c.warning,
      dark: c.warningDark,
      light: c.warningLight,
      contrastText: c.onWarning,
    },
    success: {
      main: c.success,
      dark: c.successDark,
      light: c.successLight,
      contrastText: c.onSuccess,
    },
    info: {
      main: c.info,
      dark: c.infoDark,
      light: c.infoLight,
      contrastText: c.onInfo,
    },
    neutral: {
      main: c.neutral,
      dark: mixColor(c.neutral, '#000000', 0.18),
      light: mixColor(c.neutral, '#ffffff', 0.7),
      contrastText: c.onNeutral,
    },
    // Legacy palette entries retained for existing `color="light"`/`"dark"`
    // buttons. They map to the neutral role instead of fixed blue-greys.
    light: {
      main: tokens.isDark ? '#334155' : '#f8fafc',
      dark: tokens.isDark ? '#1e293b' : '#e2e8f0',
      light: tokens.isDark ? '#475569' : '#ffffff',
      contrastText: tokens.isDark ? '#f8fafc' : '#1e293b',
    },
    dark: {
      main: tokens.isDark ? '#0f172a' : '#212529',
      dark: '#020617',
      light: '#334155',
      contrastText: '#ffffff',
    },
  };
};

const toMuiStyle = (states) => ({
  background: states.default.bg,
  backgroundColor: states.default.bg,
  color: states.default.fg,
  border: `1px solid ${states.default.border}`,
  boxShadow: 'none',
  '&:hover': {
    background: states.hover.bg,
    backgroundColor: states.hover.bg,
    color: states.hover.fg,
    borderColor: states.hover.border,
    boxShadow: 'none',
  },
  '&:active': {
    backgroundColor: states.pressed.bg,
    color: states.pressed.fg,
    borderColor: states.pressed.border,
  },
  '&.Mui-focusVisible': {
    boxShadow: states.focus.ring,
  },
  '&.Mui-disabled': {
    backgroundColor: states.disabled.bg,
    color: states.disabled.fg,
    borderColor: states.disabled.border,
  },
});

export const buildMuiButtonStyleOverrides = (tokens, options = {}) => {
  const { radius, buttonStyle } = options;
  const isPill = buttonStyle === 'pill' || tokens.legacyButtonStyle === 'pill';
  const primaryAppearance = tokens.defaultAppearance.primary;
  const roleOverride = (role, appearance) => toMuiStyle(tokens.buttons[role][appearance]);
  const styleOverrides = {
    root: {
      borderRadius: isPill ? 9999 : radius,
      textTransform: 'none',
      fontWeight: 600,
      boxShadow: 'none',
      backgroundImage: 'none',
      transition: 'background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease',
      '&:hover': { boxShadow: 'none' },
      '&.Mui-focusVisible': { boxShadow: tokens.buttons.primary.solid.focus.ring },
      '&.Mui-disabled': { boxShadow: 'none' },
    },
    containedPrimary: roleOverride('primary', primaryAppearance),
    outlinedPrimary: roleOverride('primary', 'outlined'),
    textPrimary: roleOverride('primary', 'text'),
    containedSecondary: toMuiStyle(tokens.brandSecondary.solid),
    outlinedSecondary: toMuiStyle(tokens.brandSecondary.outlined),
    textSecondary: toMuiStyle(tokens.brandSecondary.text),
    containedSuccess: roleOverride('success', 'solid'),
    outlinedSuccess: roleOverride('success', 'outlined'),
    textSuccess: roleOverride('success', 'text'),
    containedWarning: roleOverride('warning', 'solid'),
    outlinedWarning: roleOverride('warning', 'outlined'),
    textWarning: roleOverride('warning', 'text'),
    containedInfo: roleOverride('info', 'solid'),
    outlinedInfo: roleOverride('info', 'outlined'),
    textInfo: roleOverride('info', 'text'),
    // Destructive actions stay locked to Safety Red regardless of the
    // configurable error/status colour. Outlined/text destructive actions use
    // the existing cancel accent for backward compatibility.
    containedError: roleOverride('danger', 'solid'),
    outlinedError: roleOverride('danger', 'outlined'),
    textError: roleOverride('danger', 'text'),
    containedNeutral: roleOverride('neutral', 'solid'),
    outlinedNeutral: roleOverride('neutral', 'outlined'),
    textNeutral: roleOverride('neutral', 'text'),
  };
  const stateOptions = { isDark: tokens.isDark, surface: tokens.colors.surface };
  const light = createStateSet(
    tokens.isDark ? '#334155' : '#f8fafc',
    tokens.isDark ? '#f8fafc' : '#1e293b',
    tokens.isDark ? '#475569' : '#e2e8f0',
    stateOptions
  );
  const dark = createStateSet(
    tokens.isDark ? '#0f172a' : '#212529',
    '#ffffff',
    tokens.isDark ? '#1e293b' : '#212529',
    stateOptions
  );
  const variants = [
    {
      props: { color: 'light' },
      style: {
        ...toMuiStyle(light),
      },
    },
    {
      props: { variant: 'contained', color: 'light' },
      style: { ...toMuiStyle(light) },
    },
    {
      props: { variant: 'outlined', color: 'light' },
      style: { ...toMuiStyle(tokens.buttons.neutral.outlined) },
    },
    {
      props: { color: 'dark' },
      style: { ...toMuiStyle(dark) },
    },
    {
      props: { variant: 'contained', color: 'dark' },
      style: { ...toMuiStyle(dark) },
    },
    {
      props: { variant: 'outlined', color: 'dark' },
      style: { ...toMuiStyle(tokens.buttons.neutral.outlined) },
    },
    {
      props: { variant: 'link' },
      style: {
        ...toMuiStyle(tokens.buttons.primary.text),
        minWidth: 'auto',
        padding: '4px 8px',
        textDecoration: 'none',
        fontWeight: 500,
        '&:hover': {
          ...toMuiStyle(tokens.buttons.primary.text)['&:hover'],
          textDecoration: 'underline',
        },
      },
    },
  ];
  return { styleOverrides, variants };
};

export const resolveButtonState = (tokens, role, appearance, state = 'default', options = {}) => {
  const { overImage = false } = options;
  const roleKey = BUTTON_ROLES.includes(role) ? role : 'primary';
  const appearanceKey = BUTTON_APPEARANCES.includes(appearance) ? appearance : tokens.defaultAppearance[roleKey];
  const source = overImage ? tokens.onImage[appearanceKey] : tokens.buttons[roleKey][appearanceKey];
  const resolvedState = BUTTON_STATES.includes(state) ? state : 'default';
  return source[resolvedState] || source.default;
};

export const resolveButtonSx = (tokens, role = 'primary', appearance, options = {}) => {
  const { overImage = false, forcedState = null } = options;
  const roleKey = BUTTON_ROLES.includes(role) ? role : 'primary';
  const appearanceKey = BUTTON_APPEARANCES.includes(appearance) ? appearance : tokens.defaultAppearance[roleKey];
  const source = overImage ? tokens.onImage[appearanceKey] : tokens.buttons[roleKey][appearanceKey];
  const baseState = forcedState && forcedState !== 'default'
    ? (source[forcedState] || source.default)
    : source.default;
  const sx = {
    backgroundImage: 'none',
    background: baseState.bg,
    backgroundColor: baseState.bg,
    color: baseState.fg,
    border: `1px solid ${baseState.border}`,
    boxShadow: forcedState === 'focus' ? source.focus.ring : 'none',
  };
  if (!forcedState) {
    sx['&:hover'] = {
      background: source.hover.bg,
      backgroundColor: source.hover.bg,
      color: source.hover.fg,
      borderColor: source.hover.border,
      boxShadow: 'none',
    };
    sx['&:active'] = {
      backgroundColor: source.pressed.bg,
      color: source.pressed.fg,
      borderColor: source.pressed.border,
    };
    sx['&.Mui-focusVisible'] = { boxShadow: source.focus.ring };
    sx['&.Mui-disabled'] = {
      backgroundColor: source.disabled.bg,
      color: source.disabled.fg,
      borderColor: source.disabled.border,
    };
  }
  return sx;
};

export const contrastForState = (tokens, role = 'primary', appearance, state = 'default', options = {}) => {
  const resolved = resolveButtonState(tokens, role, appearance, state, options);
  return contrastRatio(resolved.fg, resolved.bg);
};
