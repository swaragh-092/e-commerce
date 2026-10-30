import platformFeatures from '../../../shared/platform-features.json';
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress } from '@mui/material';
import settingsService from '../services/settingsService';
import { DEFAULT_STORE_NAME } from '../utils/store';
import { buildCriticalThemeCss, buildStorefrontCssVariables, buildStorefrontTheme } from '../utils/theme';
import { resolveDesignTokens } from '../utils/designTokens';
import { buildAdminTheme } from '../theme/adminTheme';

export const SettingsContext = createContext(null);
// Separate context for components that ONLY need the resolved design tokens
// (CSS-variable output). Subscribers do not re-render when unrelated
// settings (payments, shipping, product page) change — only when the
// theme tokens themselves change. See HomeExperience, HeroSection, etc.
export const DesignTokensContext = createContext(null);
const CustomerThemeContext = createContext({ isDark: false, toggleDarkMode: () => {} });
export const useCustomerTheme = () => useContext(CustomerThemeContext);

/**
 * Slice hook — returns only the resolved design tokens object.
 * Re-renders only when the tokens change, not on every settings write.
 *
 * Usage: const { cssVariables, themeObj } = useDesignTokens();
 */
export const useDesignTokens = () => useContext(DesignTokensContext);

// Detect preview mode — storefront iframe loaded by the admin settings panel.
// When true, settings come from localStorage instead of the API so the admin
// can preview unsaved changes without touching production data.
const PREVIEW_KEY = 'storePreviewTheme';
const isPreviewMode = () =>
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('previewMode') === '1';

export const DEFAULT_TIER1_VISIBILITY = {
  admin: { pricing: true, cart: true, checkout: true, orders: true, payments: true, shipping: true },
  storefront: { pricing: true, cart: true, checkout: true, orders: true, payments: true, shipping: true },
};

export const DEFAULT_FALLBACK_FEATURES = {
  pricing: true,
  cart: true,
  checkout: true,
  orders: true,
  payments: true,
  shipping: true,
  ...platformFeatures.reservedDefaults,
  ...Object.fromEntries(platformFeatures.optional.map((feature) => [feature.key, feature.defaults.ecommerce])),
};

export const SettingsProvider = ({ children }) => {
  const location = useLocation();
  const isAdminRoute = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  const [settings, setSettings] = useState(null);
  const [mode, setMode] = useState('ecommerce');           // APP_MODE from server
  const [features, setFeatures] = useState(null);         // fully resolved feature map
  const [lockedKeys, setLockedKeys] = useState([]);       // Tier 1 keys — greyed-out in Settings UI
  const [visibility, setVisibility] = useState(null);     // Tier 1 admin/storefront visibility
  const [loading, setLoading] = useState(true);

  const t = settings?.theme || {};

  // Customer dark mode: localStorage override with prefers-color-scheme fallback
  const [customerDarkMode, setCustomerDarkMode] = useState(() => {
    const stored = localStorage.getItem('customerDarkMode');
    if (stored === 'true') return 'dark';
    if (stored === 'false') return 'light';
    return stored; // 'light', 'dark', or null
  });

  const toggleDarkMode = useCallback(() => {
    setCustomerDarkMode((prev) => {
      const currentResolved = prev || (t.mode || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
      const next = currentResolved === 'dark' ? 'light' : 'dark';
      localStorage.setItem('customerDarkMode', next);
      return next;
    });
  }, [t.mode]);

  // Memoize fetchSettings so any consumer that depends on `refreshSettings`
  // in a useEffect dep array does not infinite-loop. The previous version
  // returned a fresh closure on every render, which made ThemeGalleryPage's
  // 5 dependent effects re-fire on every render.
  const fetchSettings = useCallback(async () => {
    try {
      let data;
      // In preview mode read from localStorage — avoids API call and keeps
      // production data untouched while the admin previews unsaved changes.
      if (isPreviewMode()) {
        const raw = localStorage.getItem(PREVIEW_KEY);
        data = raw ? JSON.parse(raw) : {};
      } else {
        try {
          data = await settingsService.getAllSettings();
        } catch (settingsError) {
          const status = settingsError?.response?.status;
          if (status !== 401 && status !== 403) throw settingsError;
          data = await settingsService.getPublicSettings();
        }
      }

      const [, featureData] = await Promise.all([
        Promise.resolve(data),
        settingsService.getFeatures(),
      ]);

      setSettings(data);
      setMode(featureData?.mode || 'ecommerce');
      setFeatures({ ...data?.features, ...featureData?.features });
      setLockedKeys(featureData?.lockedKeys || []);
      setVisibility(featureData?.visibility || DEFAULT_TIER1_VISIBILITY);
      if (!isPreviewMode()) applyDocumentSettings(data);
    } catch (error) {
      console.error("Failed to load settings", error);
      // Fallback defaults — safe for both modes
      setSettings({
        theme: { primaryColor: '#1976d2', mode: 'light', fontFamily: 'Roboto' },
        general: { storeName: DEFAULT_STORE_NAME },
        features: { ...DEFAULT_FALLBACK_FEATURES },
        payments: {
          razorpayEnabled: true,
          stripeEnabled: false,
          payuEnabled: false,
          cashfreeEnabled: false,
          codEnabled: true,
          defaultMethod: 'razorpay',
        },
        productPage: {
          showSKU: true,
          showStockBadge: true,
          imageAlignment: 'horizontal',
          addToCartLabel: 'Add to Cart',
          showBuyNowButton: true,
          buyNowLabel: 'Buy Now',
        },
        sales: {
          allowScheduling: true,
          allowBulkSales: true,
          showCountdown: true,
          showSaleTiming: true,
          showSavingsAmount: true,
          showDiscountPercent: true,
          showSaleLabel: true,
          defaultSaleLabel: 'Limited Time Offer',
          endingSoonHours: 24,
        },
      });
      // On error, keep mode as ecommerce so the app doesn't silently hide features
      setMode('ecommerce');
      setFeatures({ ...DEFAULT_FALLBACK_FEATURES });
      setVisibility(DEFAULT_TIER1_VISIBILITY);
      // Fallback: treat all known Tier 1 keys as locked so UI remains correct offline
      setLockedKeys(['pricing','cart','checkout','orders','payments','shipping','enquiry']);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyDocumentSettings = (data) => {
    // Page title
    if (data?.general?.storeName) {
      document.title = data.general.storeName;
    }

    // Meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && data?.seo?.defaultDescription) {
      metaDesc.setAttribute('content', data.seo.defaultDescription);
    }

    // Favicon
    if (data?.logo?.favicon) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = data.logo.favicon;
    }

    // Google Fonts — load only the weights actually used by the theme so we
    // don't request 7 weight files per family. See issue M4.
    if (data?.theme?.fontFamily || data?.theme?.headingFont) {
      const fonts = new Set();
      if (data.theme.fontFamily) fonts.add(data.theme.fontFamily);
      if (data.theme.headingFont && data.theme.headingFont !== data.theme.fontFamily) {
        fonts.add(data.theme.headingFont);
      }
      const bodyWeight = parseInt(data.theme.bodyWeight, 10) || 400;
      const headingWeight = parseInt(data.theme.headingWeight, 10) || 700;
      const weightSet = new Set([bodyWeight, headingWeight, 400, 700]);
      const weightStr = [...weightSet].sort((a, b) => a - b).join(';');
      const families = [...fonts]
        .map((f) => `family=${f.replace(/\s+/g, '+')}:wght@${weightStr}`)
        .join('&');
      const linkId = 'google-font-link';
      let link = document.getElementById(linkId);
      if (!link) {
        link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const storefrontTokens = useMemo(
    () => resolveDesignTokens(t, customerDarkMode),
    [t, customerDarkMode]
  );
  const isDark = isAdminRoute ? false : storefrontTokens.isDark;
  const themeConfig = useMemo(
    () => (isAdminRoute ? buildAdminTheme(settings?.admin) : createTheme(buildStorefrontTheme(t, customerDarkMode))),
    [isAdminRoute, settings?.admin, t, customerDarkMode]
  );
  // Resolved design tokens — used by DesignTokensContext subscribers.
  // Admin routes deliberately receive the stable admin theme, never merchant
  // storefront tokens, so saved storefront styling cannot leak into admin UI.
  const designTokens = useMemo(
    () => ({
      cssVariables: isAdminRoute ? {} : buildStorefrontCssVariables(t, customerDarkMode),
      tokens: storefrontTokens,
      themeObj: t,
      isAdminRoute,
    }),
    [isAdminRoute, storefrontTokens, t, customerDarkMode]
  );

  // Memoize the SettingsContext value object — without this, every
  // consumer of useSettings() re-renders on ANY change to any of the
  // 6 fields below. Combined with the new DesignTokensContext, components
  // that only need theme tokens can subscribe to that instead and stay
  // untouched by payments/shipping/etc. writes.
  const value = useMemo(
    () => ({
      settings,
      mode,        // 'ecommerce' | 'catalog'
      features,    // fully resolved feature map — use useFeature() to read individual flags
      visibility,  // Tier 1 presentation switches — use useFeatureVisible()
      lockedKeys,  // Tier 1 keys — use useIsFeatureLocked() to read
      loading,
      refreshSettings: fetchSettings,
    }),
    [settings, mode, features, visibility, lockedKeys, loading, fetchSettings]
  );

  // Expose resolved storefront design tokens as CSS custom properties for custom CSS and widgets.
  // Admin routes must not receive merchant tokens: the admin theme is stable and
  // independent from storefront design settings.
  useEffect(() => {
    if (isAdminRoute) return undefined;
    const vars = buildStorefrontCssVariables(t, customerDarkMode);
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));

    return () => {
      Object.keys(vars).forEach((key) => root.style.removeProperty(key));
    };
  }, [isAdminRoute, t, customerDarkMode]);

  // In preview mode: listen for postMessage from the admin panel to apply
  // updated CSS vars instantly (colour/font changes without iframe reload).
  useEffect(() => {
    if (!isPreviewMode()) return;
    const handler = (event) => {
      if (
        event.origin !== window.location.origin ||
        event.data?.type !== 'PREVIEW_THEME_UPDATE'
      ) return;
      const root = document.documentElement;
      Object.entries(event.data.vars || {}).forEach(([key, value]) =>
        root.style.setProperty(key, value)
      );
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Inject critical CSS and package-level asset hints from theme settings.
  useEffect(() => {
    if (isAdminRoute) {
      document.getElementById('theme-critical-css')?.remove();
      return undefined;
    }
    const criticalCss = settings?.theme?.criticalCSS || settings?.theme?.performance?.criticalCSS || buildCriticalThemeCss(t, customerDarkMode);
    const styleId = 'theme-critical-css';
    let style = document.getElementById(styleId);

    if (criticalCss) {
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        style.setAttribute('data-storefront-performance', 'critical-css');
        document.head.prepend(style);
      }
      style.textContent = criticalCss;
    } else if (style) {
      style.remove();
    }
  }, [isAdminRoute, settings?.theme?.criticalCSS, settings?.theme?.performance?.criticalCSS, t, customerDarkMode]);

  useEffect(() => {
    if (isAdminRoute) return undefined;
    const perf = settings?.theme?.performance || {};
    const assets = [
      ...(Array.isArray(perf.preloadAssets) ? perf.preloadAssets.map((asset) => ({ ...asset, rel: 'preload' })) : []),
      ...(Array.isArray(perf.prefetchAssets) ? perf.prefetchAssets.map((asset) => ({ ...asset, rel: 'prefetch' })) : []),
      ...(Array.isArray(perf.assetHints) ? perf.assetHints : []),
    ].filter((asset) => asset?.href);

    document.querySelectorAll('link[data-theme-asset-hint="true"]').forEach((node) => node.remove());

    assets.forEach((asset) => {
      const link = document.createElement('link');
      link.setAttribute('data-theme-asset-hint', 'true');
      link.rel = asset.rel || 'preload';
      link.href = asset.href;
      if (asset.as) link.as = asset.as;
      if (asset.type) link.type = asset.type;
      if (asset.crossOrigin) link.crossOrigin = asset.crossOrigin;
      if (asset.media) link.media = asset.media;
      if (asset.fetchPriority) link.fetchPriority = asset.fetchPriority;
      document.head.appendChild(link);
    });

    return () => {
      document.querySelectorAll('link[data-theme-asset-hint="true"]').forEach((node) => node.remove());
    };
  }, [isAdminRoute, settings?.theme?.performance]);

  // Inject custom CSS from admin settings
  useEffect(() => {
    if (isAdminRoute) {
      document.getElementById('admin-custom-css')?.remove();
      return undefined;
    }
    const customCss = settings?.advanced?.customCSS;
    const styleId = 'admin-custom-css';
    let style = document.getElementById(styleId);
    if (customCss) {
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
      }
      style.textContent = customCss;
    } else if (style) {
      style.remove();
    }
  }, [isAdminRoute, settings?.advanced?.customCSS]);

  // Inject custom Head & Body scripts from admin settings
  useEffect(() => {
    if (isAdminRoute) return undefined;
    const headScripts = settings?.advanced?.headScripts;
    const bodyScripts = settings?.advanced?.bodyScripts;

    const injectHtmlSnippet = (htmlString, targetContainer, scriptClass) => {
      const existing = targetContainer.querySelectorAll(`.${scriptClass}`);
      existing.forEach(el => el.remove());

      if (!htmlString || !htmlString.trim()) {
        return;
      }

      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${htmlString}</div>`, 'text/html');
        const parsedContainer = doc.querySelector('div');

        if (!parsedContainer) return;

        const nodes = Array.from(parsedContainer.childNodes);
        for (const node of nodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            let newEl;
            if (node.nodeName.toLowerCase() === 'script') {
              newEl = document.createElement('script');
              for (const attr of Array.from(node.attributes)) {
                newEl.setAttribute(attr.name, attr.value);
              }
              newEl.textContent = node.textContent;
            } else {
              newEl = node.cloneNode(true);
            }

            if (newEl && newEl.nodeType === Node.ELEMENT_NODE) {
              newEl.classList.add(scriptClass);
              targetContainer.appendChild(newEl);
            }
          }
        }
      } catch (err) {
        console.error(`Error injecting script for ${scriptClass}:`, err);
      }
    };

    injectHtmlSnippet(headScripts, document.head, 'admin-head-script');
    injectHtmlSnippet(bodyScripts, document.body, 'admin-body-script');

    return () => {
      document.head.querySelectorAll('.admin-head-script').forEach(el => el.remove());
      document.body.querySelectorAll('.admin-body-script').forEach(el => el.remove());
    };
  }, [isAdminRoute, settings?.advanced?.headScripts, settings?.advanced?.bodyScripts]);

  return (
    <SettingsContext.Provider value={value}>
      <DesignTokensContext.Provider value={designTokens}>
        <CustomerThemeContext.Provider value={{ isDark, toggleDarkMode }}>
          <ThemeProvider theme={themeConfig}>
            <CssBaseline />
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <CircularProgress />
              </Box>
            ) : children}
          </ThemeProvider>
        </CustomerThemeContext.Provider>
      </DesignTokensContext.Provider>
    </SettingsContext.Provider>
  );
};
