'use strict';

/**
 * Two-Tier Feature Architecture
 * ─────────────────────────────
 *
 * Tier 1 — Mode-Locked (non-negotiable)
 *   Determined entirely by APP_MODE. Admin CANNOT change these via Settings.
 *   They are the structural backbone with hard dependencies:
 *     pricing → cart → checkout → orders → { payments, shipping }
 *   In ecommerce mode all are ON; in catalog mode all are OFF.
 *   enquiry is the inverse: OFF in ecommerce, ON in catalog.
 *
 * Tier 2 — Optional (admin-controlled)
 *   Each mode has sensible defaults but the admin can override any of
 *   these freely from the Settings panel. The DB value always wins for Tier 2.
 *
 * Merge order in buildFeatures() (last writer wins):
 *   1. TIER2_DEFAULTS[mode]   — baseline for optional features
 *   2. DB features            — admin overrides for Tier 2 only
 *   3. TIER1_FEATURES[mode]   — always applied last, cannot be overridden
 */

const VALID_MODES = ['ecommerce', 'catalog'];
let warnedUnknownMode = false;

// ─── Tier 1: Mode-Locked ──────────────────────────────────────────────────────

const TIER1_FEATURES = {
  ecommerce: {
    pricing:  true,
    cart:     true,
    checkout: true,
    orders:   true,
    payments: true,
    shipping: true,
    enquiry:  false,   // enquiry-based flow is catalog-only
  },
  catalog: {
    pricing:  false,
    cart:     false,
    checkout: false,
    orders:   false,
    payments: false,
    shipping: false,
    enquiry:  true,    // catalog mode forces enquiry ON
  },
};

/** Set of all Tier 1 feature keys — used server-side to reject admin update attempts */
const TIER1_KEYS = new Set(Object.keys(TIER1_FEATURES.ecommerce));

/**
 * Returns true if the given feature key is Tier 1 (mode-locked).
 * Any attempt to write a Tier 1 key via settings should be rejected with 403.
 */
const isTier1Feature = (key) => TIER1_KEYS.has(key);

// ─── Tier 2: Optional, Admin-Controlled ──────────────────────────────────────
// These are PER-MODE defaults. The DB can override any of these.
// Note: guestCheckout is Tier 2 but the Settings UI auto-hides it when
// checkout (Tier 1) is locked OFF — it becomes irrelevant in catalog mode.

const TIER2_DEFAULTS = {
  ecommerce: {
    wishlist:                 true,
    reviews:                  true,
    coupons:                  true,
    guestCheckout:            true,
    seo:                      true,
    emailVerification:        false,
    requirePurchaseForReview: false,
    showAvailableCoupons:     true,
    multiCurrency:            false,
    socialLogin:              false,
  },
  catalog: {
    wishlist:                 false,  // no personal features by default in catalog
    reviews:                  true,
    coupons:                  false,  // coupons are ecommerce-centric by default
    guestCheckout:            true,   // toggleable but auto-hides in UI (checkout is off)
    seo:                      true,
    emailVerification:        false,
    requirePurchaseForReview: false,
    showAvailableCoupons:     false,
    multiCurrency:            false,
    socialLogin:              false,
  },
};

// ─── Mode Resolution ──────────────────────────────────────────────────────────

/**
 * Returns the validated current mode.
 * Defaults to 'ecommerce' if APP_MODE is missing or unrecognised —
 * this keeps existing deployments working without any ENV change.
 *
 * @returns {'ecommerce'|'catalog'}
 */
const getMode = () => {
  const raw = (process.env.APP_MODE || '').toLowerCase().trim();
  if (VALID_MODES.includes(raw)) return raw;

  if (raw && !warnedUnknownMode) {
    // eslint-disable-next-line no-console
    console.warn(
      `[modes] Unknown APP_MODE="${process.env.APP_MODE}". Falling back to "ecommerce".`
    );
    warnedUnknownMode = true;
  }
  return 'ecommerce';
};

// ─── Feature Map Builder ──────────────────────────────────────────────────────

/**
 * Builds the final resolved feature map using a 3-layer merge.
 *
 * Layer 1 — TIER2_DEFAULTS[mode]: per-mode baseline for optional features
 * Layer 2 — dbFeatures:           admin overrides (Tier 2 keys only; Tier 1 writes are rejected server-side)
 * Layer 3 — TIER1_FEATURES[mode]: mode-locked backbone; always applied last, never overridable
 *
 * @param {Record<string, boolean>} dbFeatures - Parsed feature settings from the DB
 * @returns {Record<string, boolean>} Fully resolved feature map
 */
const buildFeatures = (dbFeatures) => {
  const mode = getMode();
  const safeDb = dbFeatures || {};

  return {
    ...TIER2_DEFAULTS[mode],      // Layer 1: optional defaults for this mode
    ...safeDb,                    // Layer 2: admin overrides (DB)
    ...TIER1_FEATURES[mode],      // Layer 3: mode-locked — always wins
  };
};

module.exports = {
  VALID_MODES,
  TIER1_FEATURES,
  TIER1_KEYS,
  TIER2_DEFAULTS,
  isTier1Feature,
  getMode,
  buildFeatures,
  // Keep old export name as alias so any existing imports don't break
  MODE_CORE_FEATURES: TIER1_FEATURES,
};
