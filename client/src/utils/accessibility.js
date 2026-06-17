/**
 * accessibility.js
 *
 * WCAG 2.1 contrast ratio calculations.
 * Pure utility — no React, no MUI, no side-effects.
 *
 * References:
 *   https://www.w3.org/TR/WCAG21/#contrast-minimum (SC 1.4.3)
 *   https://www.w3.org/TR/WCAG21/#contrast-enhanced (SC 1.4.6)
 *   https://www.w3.org/WAI/WCAG21/Techniques/general/G18
 */

// ─── Colour math ─────────────────────────────────────────────────────────────

/**
 * Parse a 3- or 6-digit hex string (with or without #) into [r, g, b] 0-255.
 * Returns null when the input is not parseable.
 */
export const hexToRgb = (hex) => {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace(/^#/, '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return [r, g, b];
  }
  return null;
};

/**
 * Convert a single 0-255 channel to its linearised (sRGB) value per WCAG spec.
 */
const linearise = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

/**
 * Relative luminance of a hex colour, per WCAG 2.1.
 * Returns a value in [0, 1] — 0 = black, 1 = white.
 * Returns null for unparseable inputs.
 */
export const relativeLuminance = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
};

/**
 * WCAG 2.1 contrast ratio between two hex colours.
 * Returns a number in [1, 21] — higher is better.
 * Returns null if either colour is unparseable.
 */
export const contrastRatio = (hex1, hex2) => {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  if (l1 === null || l2 === null) return null;
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

// ─── WCAG level evaluation ────────────────────────────────────────────────────

/**
 * WCAG thresholds:
 *   Normal text:  AA ≥ 4.5 : 1   AAA ≥ 7 : 1
 *   Large text:   AA ≥ 3 : 1     AAA ≥ 4.5 : 1
 *   UI elements:  AA ≥ 3 : 1
 */
export const WCAG = {
  AA_NORMAL: 4.5,
  AA_LARGE:  3.0,
  AAA_NORMAL: 7.0,
  AAA_LARGE:  4.5,
  UI: 3.0,
};

/**
 * Evaluate a colour pair against WCAG thresholds.
 *
 * @param {string} foreground  hex colour
 * @param {string} background  hex colour
 * @returns {{ ratio: number|null, aa: boolean, aaa: boolean, aaLarge: boolean, level: 'AAA'|'AA'|'AA Large'|'Fail'|'N/A' }}
 */
export const evaluateContrast = (foreground, background) => {
  const ratio = contrastRatio(foreground, background);
  if (ratio === null) {
    return { ratio: null, aa: false, aaa: false, aaLarge: false, level: 'N/A' };
  }

  const aa      = ratio >= WCAG.AA_NORMAL;
  const aaa     = ratio >= WCAG.AAA_NORMAL;
  const aaLarge = ratio >= WCAG.AA_LARGE;

  let level;
  if (aaa)         level = 'AAA';
  else if (aa)     level = 'AA';
  else if (aaLarge) level = 'AA Large';
  else             level = 'Fail';

  return { ratio, aa, aaa, aaLarge, level };
};

// ─── Colour pair audit for the theme ─────────────────────────────────────────

/**
 * Run the WCAG audit for the pairs that matter in a storefront theme:
 *   - text on background       (body copy)
 *   - text on surface          (card content)
 *   - primary on background    (links / chips)
 *   - white on primary         (button text legibility)
 *   - white on secondary       (button text legibility)
 *   - secondary on background  (badges / CTAs)
 *   - error on background      (form errors / status)
 *   - success on background    (form success / status)
 *
 * Returns an array of { label, foreground, background, ...evaluateContrast }
 */
export const auditThemeContrast = ({
  primaryColor,
  secondaryColor,
  backgroundColor,
  surfaceColor,
  textColor,
  errorColor,
  successColor,
}) => {
  const pairs = [
    { label: 'Text / Background',       foreground: textColor,      background: backgroundColor },
    { label: 'Text / Surface',          foreground: textColor,      background: surfaceColor || backgroundColor },
    { label: 'Primary / Background',    foreground: primaryColor,   background: backgroundColor },
    { label: 'White / Primary',         foreground: '#ffffff',      background: primaryColor },
    { label: 'White / Secondary',       foreground: '#ffffff',      background: secondaryColor },
    { label: 'Secondary / Background',  foreground: secondaryColor, background: backgroundColor },
  ];
  if (errorColor)   pairs.push({ label: 'Error / Background',   foreground: errorColor,   background: backgroundColor });
  if (successColor) pairs.push({ label: 'Success / Background', foreground: successColor, background: backgroundColor });

  return pairs.map(({ label, foreground, background }) => ({
    label,
    foreground,
    background,
    ...evaluateContrast(foreground, background),
  }));
};

// ─── Score helper ─────────────────────────────────────────────────────────────

/**
 * Aggregate accessibility score (0–100) based on audited pairs.
 * AAA = full weight, AA = partial, AA Large = minimal, Fail = 0.
 */
export const accessibilityScore = (pairs) => {
  if (!pairs || pairs.length === 0) return 0;
  const weights = { AAA: 100, AA: 75, 'AA Large': 40, Fail: 0, 'N/A': 0 };
  const total = pairs.reduce((sum, p) => sum + (weights[p.level] ?? 0), 0);
  return Math.round(total / pairs.length);
};
