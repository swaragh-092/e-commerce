/**
 * styleMaps.js
 *
 * Shared radius / shadow style maps used by storefront section components.
 * Centralised so semantic tokens (e.g. "pill") resolve to the same value
 * across ProductCard, CategorySection, PromoBannerSection, TrustSection,
 * and any other consumer — see issue H3 in docs/DESIGN-SYSTEM-ISSUES.md.
 *
 * Note: MUI `sx` accepts theme.spacing-style multipliers and full CSS strings.
 * The shared tokens below are CSS values (px) so that "pill" means the same
 * thing everywhere (matches --store-radius-full at 9999px).
 */

const SHADOW_VARS = {
  none:   'var(--store-shadow-none, none)',
  soft:   'var(--store-shadow-soft, 0 4px 14px rgba(15, 23, 42, 0.08))',
  medium: 'var(--store-shadow-medium, 0 10px 28px rgba(15, 23, 42, 0.12))',
  strong: 'var(--store-shadow-strong, 0 18px 44px rgba(15, 23, 42, 0.18))',
};

// MUI sx `borderRadius` accepts a multiplier or a CSS length. We use a small
// integer scale (0/4/8/12/16) for the non-pill tiers and the full pill value
// for "pill" so that the semantic matches the CSS variable token.
const RADIUS_TOKENS = {
  none:   '0px',
  small:  '4px',
  medium: '8px',
  large:  '12px',
  pill:   '9999px',
  full:   '9999px',
};

export const radiusMap = {
  none:   RADIUS_TOKENS.none,
  small:  RADIUS_TOKENS.small,
  medium: RADIUS_TOKENS.medium,
  large:  RADIUS_TOKENS.large,
  pill:   RADIUS_TOKENS.pill,
  full:   RADIUS_TOKENS.full,
};

export const shadowMap = { ...SHADOW_VARS };

/**
 * Resolve a radius token to its canonical CSS length.
 * Falls back to the medium token when the input is not recognised.
 */
export const resolveRadius = (token, fallback = RADIUS_TOKENS.medium) =>
  radiusMap[token] ?? fallback;

/**
 * Resolve a shadow token to its CSS box-shadow value.
 * Falls back to the provided fallback (defaulting to "none") when the input
 * is not recognised.
 */
export const resolveShadow = (token, fallback = SHADOW_VARS.none) =>
  shadowMap[token] ?? fallback;

// ─── Hero overlay gradient presets ─────────────────────────────────────────
//
// The hero overlay is a single linear gradient drawn over the carousel
// image. We expose a small set of semantic directions ("left", "right",
// "top", "bottom", "centered") so admins can pick a feel without authoring
// raw CSS. Each preset defines an angle and a list of stop opacities; the
// helper renders those into a linear-gradient string and lets slide /
// section config override the opacities independently of the direction.
// See issue L2 in docs/DESIGN-SYSTEM-ISSUES.md.
const HERO_GRADIENT_PRESETS = {
  left:     { angle: 90,  stops: [0.64, 0.32, 0.08] },
  right:    { angle: 90,  stops: [0.08, 0.32, 0.64] },
  top:      { angle: 180, stops: [0.58, 0.18] },
  bottom:   { angle: 180, stops: [0.18, 0.58] },
  centered: { angle: 180, stops: [0.18, 0.58] },
  none:     null,
};

const formatHeroGradient = (preset, { start, mid, end }) => {
  if (preset.stops.length === 3) {
    return `linear-gradient(${preset.angle}deg, rgba(0,0,0,${start}) 0%, rgba(0,0,0,${mid}) 50%, rgba(0,0,0,${end}) 100%)`;
  }
  return `linear-gradient(${preset.angle}deg, rgba(0,0,0,${start}) 0%, rgba(0,0,0,${end}) 100%)`;
};

/**
 * Resolve a hero overlay gradient string.
 *
 * Accepts an options object with any of:
 *   - gradient:    'left' | 'right' | 'top' | 'bottom' | 'centered' | 'none'
 *   - aligned:     'left' | 'center' | 'right' — used to pick a default
 *                  direction when `gradient` is not set (mirrors the original
 *                  centered-vs-not behavior).
 *   - overlayStart / overlayMid / overlayEnd: 0..1 opacities to override the
 *                  preset's stop opacities.
 *
 * Returns either a `linear-gradient(...)` CSS string or 'none' to disable
 * the overlay.
 */
export const resolveHeroGradient = ({
  gradient,
  aligned = 'left',
  overlayStart,
  overlayMid,
  overlayEnd,
} = {}) => {
  if (gradient === 'none') return 'none';
  const token = gradient || (aligned === 'center' ? 'bottom' : 'left');
  const preset = HERO_GRADIENT_PRESETS[token] || HERO_GRADIENT_PRESETS.left;
  if (!preset) return 'none';
  const [s, e, m] = preset.stops;
  return formatHeroGradient(preset, {
    start: overlayStart ?? s,
    mid:   overlayMid   ?? m,
    end:   overlayEnd   ?? e,
  });
};
