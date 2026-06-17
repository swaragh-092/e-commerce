/**
 * themeScore.js
 *
 * Lightweight heuristic scoring for a theme package.
 * Returns two scores (0–100, higher = better):
 *
 *   performanceScore  — estimates runtime render weight
 *                       (fonts, CSS complexity, section count)
 *   accessibilityScore — WCAG contrast pass rate for the theme's colour palette
 *
 * Pure functions — no React, no MUI, no side-effects.
 */
import { auditThemeContrast, accessibilityScore as wcagScore } from './accessibility';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));

// ─── Performance Score ────────────────────────────────────────────────────────

/**
 * Penalty table — each entry subtracts from 100.
 *
 * Rationale:
 *   - Google Fonts: each distinct font family is an extra network request + CLS risk
 *   - Custom CSS length: large injected CSS blocks increase style recalc time
 *   - Homepage sections: more sections = more DOM, more LCP candidates, more reflows
 *   - Data sources: each API Builder source = extra async fetch on first render
 *   - Component style complexity: many overridden card types = more MUI theme merges
 *   - Animations / transitions: heavy motion = layout thrashing on low-end devices
 *   - Dark palette: dual-palette themes do an extra colour resolve on init
 */
const scorePerformance = (pkg) => {
  const design = pkg?.design?.theme || {};
  const layout = pkg?.layout || {};
  const sections = layout.homepageSections || [];
  const dataSources = pkg?.dataSources || [];
  const componentStyles = pkg?.componentStyles || {};
  const customCSS = (design.customCSS || '').length;

  let penalty = 0;

  // ── Fonts (each distinct Google Font = 8pt penalty, max 2 fonts recommended)
  const fonts = new Set([design.fontFamily, design.headingFont].filter(Boolean));
  const extraFonts = Math.max(0, fonts.size - 1); // 1 font is the baseline
  penalty += extraFonts * 8;

  // ── Custom CSS size
  if (customCSS > 5000) penalty += 15;
  else if (customCSS > 2000) penalty += 8;
  else if (customCSS > 500) penalty += 3;

  // ── Homepage section count (each section over 4 = minor penalty)
  const extraSections = Math.max(0, sections.length - 4);
  penalty += Math.min(extraSections * 4, 20);

  // ── Data sources (each extra API fetch = latency risk)
  penalty += Math.min(dataSources.length * 5, 15);

  // ── Component style overrides (more = heavier MUI theme merge)
  const styleCount = Object.keys(componentStyles).length;
  if (styleCount > 5) penalty += 5;

  // ── Dark palette (extra colour resolution on init)
  // Intentionally not penalised — a separate dark palette is a feature
  // customers expect, not a performance issue. See issue L4.

  return clamp(100 - penalty);
};

// ─── Accessibility Score ──────────────────────────────────────────────────────

/**
 * Uses the WCAG contrast engine to evaluate the 4 critical colour pairs.
 * Returns 0-100 based on how many pairs pass AA.
 */
const scoreAccessibility = (pkg) => {
  const design = pkg?.design?.theme || {};
  const { primaryColor, backgroundColor, textColor, secondaryColor } = design;

  // If the theme has no colours defined, we can't evaluate it
  if (!primaryColor && !backgroundColor && !textColor) return null;

  const pairs = auditThemeContrast({
    primaryColor:   primaryColor   || '#0f766e',
    backgroundColor: backgroundColor || '#f7f3ec',
    textColor:      textColor      || '#1f2933',
    secondaryColor:  secondaryColor  || '#f97316',
  });

  return wcagScore(pairs);
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Score a theme package and return both scores plus metadata.
 *
 * @param {object} pkg  theme package (packageData from API)
 * @returns {{
 *   performance: number,        // 0–100
 *   accessibility: number|null, // 0–100 or null if colours missing
 *   performanceLabel: string,   // 'Excellent'|'Good'|'Fair'|'Heavy'
 *   accessibilityLabel: string, // 'AAA'|'AA'|'Partial'|'Fail'|'N/A'
 *   performanceColor: string,   // MUI colour name
 *   accessibilityColor: string,
 * }}
 */
export const scoreTheme = (pkg) => {
  const performance    = scorePerformance(pkg);
  const accessibility  = scoreAccessibility(pkg);

  // Performance label
  let performanceLabel, performanceColor;
  if (performance >= 90)     { performanceLabel = 'Fast';      performanceColor = 'success'; }
  else if (performance >= 75) { performanceLabel = 'Good';      performanceColor = 'success'; }
  else if (performance >= 55) { performanceLabel = 'Fair';      performanceColor = 'warning'; }
  else                        { performanceLabel = 'Heavy';     performanceColor = 'error'; }

  // Accessibility label
  let accessibilityLabel, accessibilityColor;
  if (accessibility === null)      { accessibilityLabel = 'N/A';      accessibilityColor = 'default'; }
  else if (accessibility >= 90)    { accessibilityLabel = 'AAA';      accessibilityColor = 'success'; }
  else if (accessibility >= 65)    { accessibilityLabel = 'AA';       accessibilityColor = 'success'; }
  else if (accessibility >= 35)    { accessibilityLabel = 'Partial';  accessibilityColor = 'warning'; }
  else                             { accessibilityLabel = 'Fail';     accessibilityColor = 'error'; }

  return {
    performance,
    accessibility,
    performanceLabel,
    performanceColor,
    accessibilityLabel,
    accessibilityColor,
  };
};
