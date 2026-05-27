import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress } from '@mui/material';
import settingsService from '../services/settingsService';
import { DEFAULT_STORE_NAME } from '../utils/store';

export const SettingsContext = createContext(null);
const CustomerThemeContext = createContext({ isDark: false, toggleDarkMode: () => {} });
export const useCustomerTheme = () => useContext(CustomerThemeContext);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);
  const [mode, setMode] = useState('ecommerce');           // APP_MODE from server
  const [features, setFeatures] = useState(null);         // fully resolved feature map
  const [lockedKeys, setLockedKeys] = useState([]);       // Tier 1 keys — greyed-out in Settings UI
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

  const fetchSettings = async () => {
    try {
      // Fetch settings and features in parallel — one round-trip each
      const [data, featureData] = await Promise.all([
        settingsService.getAllSettings(),
        settingsService.getFeatures(),
      ]);

      setSettings(data);
      setMode(featureData?.mode || 'ecommerce');
      // Merge: mode-resolved features override anything in settings.features
      setFeatures({ ...data?.features, ...featureData?.features });
      setLockedKeys(featureData?.lockedKeys || []);
      applyDocumentSettings(data);
    } catch (error) {
      console.error("Failed to load settings", error);
      // Fallback defaults — safe for both modes
      setSettings({
        theme: { primaryColor: '#1976d2', mode: 'light', fontFamily: 'Roboto' },
        general: { storeName: DEFAULT_STORE_NAME },
        features: { wishlist: true, reviews: true, coupons: true, guestCheckout: true, seo: true },
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
      setFeatures({ wishlist: true, reviews: true, pricing: true, cart: true, checkout: true });
      // Fallback: treat all known Tier 1 keys as locked so UI remains correct offline
      setLockedKeys(['pricing','cart','checkout','orders','payments','shipping','enquiry']);
    } finally {
      setLoading(false);
    }
  };

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

    // Google Fonts — load both heading and body fonts
    if (data?.theme?.fontFamily || data?.theme?.headingFont) {
      const fonts = new Set();
      if (data.theme.fontFamily) fonts.add(data.theme.fontFamily);
      if (data.theme.headingFont) fonts.add(data.theme.headingFont);
      const families = [...fonts]
        .map((f) => `family=${f.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800;900`)
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

  const radius = parseInt(t.borderRadius) || 8;
  const themeMode = customerDarkMode 
    ? customerDarkMode 
    : (t.mode || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const isDark = themeMode === 'dark';
  const fallbackPrimary = isDark ? '#4fd1a5' : '#0f766e';
  const fallbackSecondary = isDark ? '#ffb86b' : '#f97316';
  const fallbackBackground = isDark ? '#101514' : '#f7f3ec';
  const fallbackSurface = isDark ? '#17211f' : '#fffaf2';
  const fallbackText = isDark ? '#f8fafc' : '#1f2933';
  const backgroundStyle = t.backgroundStyle || 'softGradient';
  const buttonStyle = t.buttonStyle || 'solid';
  const cardStyle = t.cardStyle || 'elevated';

  // If resolved mode matches the settings mode, use the admin settings colors.
  // Otherwise, use theme-appropriate fallbacks.
  const useAdminColors = t.mode === themeMode;

  const primaryMain = useAdminColors ? (t.primaryColor || fallbackPrimary) : fallbackPrimary;
  const secondaryMain = useAdminColors ? (t.secondaryColor || fallbackSecondary) : fallbackSecondary;
  const backgroundDefault = useAdminColors ? (t.backgroundColor || fallbackBackground) : fallbackBackground;
  const surfaceColor = useAdminColors ? (t.surfaceColor || fallbackSurface) : fallbackSurface;
  const textColor = useAdminColors ? (t.textColor || fallbackText) : fallbackText;

  const themeConfig = createTheme({
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
        main: '#e11d48',
      },
      warning: {
        main: '#d97706',
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
      fontFamily: t.fontFamily
        ? `"${t.fontFamily}", "Roboto", "Helvetica", "Arial", sans-serif`
        : '"Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontSize: '2.5rem', fontWeight: t.headingWeight ? parseInt(t.headingWeight) : 800, letterSpacing: t.headingLetterSpacing || '0px', ...(t.headingFont && { fontFamily: `"${t.headingFont}", "Roboto", sans-serif` }) },
      h2: { fontSize: '2rem', fontWeight: t.headingWeight ? parseInt(t.headingWeight) : 800, letterSpacing: t.headingLetterSpacing || '0px', ...(t.headingFont && { fontFamily: `"${t.headingFont}", "Roboto", sans-serif` }) },
      h3: { fontSize: '1.75rem', fontWeight: t.headingWeight ? parseInt(t.headingWeight) : 700, letterSpacing: t.headingLetterSpacing || '0px', ...(t.headingFont && { fontFamily: `"${t.headingFont}", "Roboto", sans-serif` }) },
      h4: { fontSize: '1.5rem', fontWeight: t.headingWeight ? parseInt(t.headingWeight) : 700, letterSpacing: t.headingLetterSpacing || '0px', ...(t.headingFont && { fontFamily: `"${t.headingFont}", "Roboto", sans-serif` }) },
      h5: { fontSize: '1.25rem', fontWeight: t.headingWeight ? parseInt(t.headingWeight) : 800, letterSpacing: t.headingLetterSpacing || '0px', ...(t.headingFont && { fontFamily: `"${t.headingFont}", "Roboto", sans-serif` }) },
      h6: { fontSize: '1rem', fontWeight: t.headingWeight ? parseInt(t.headingWeight) : 700, letterSpacing: t.headingLetterSpacing || '0px', ...(t.headingFont && { fontFamily: `"${t.headingFont}", "Roboto", sans-serif` }) },
      body1: {
        fontWeight: t.bodyWeight ? parseInt(t.bodyWeight) : 400,
        lineHeight: t.lineHeight || 1.5,
        letterSpacing: t.letterSpacing || '0px',
      },
      body2: {
        fontWeight: t.bodyWeight ? parseInt(t.bodyWeight) : 400,
        lineHeight: t.lineHeight || 1.5,
        letterSpacing: t.letterSpacing || '0px',
      },
      button: { textTransform: 'none', fontWeight: 700 },
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
          body: {
            background:
              backgroundStyle === 'softGradient'
                ? `linear-gradient(180deg, ${backgroundDefault} 0%, ${surfaceColor} 48%, ${backgroundDefault} 100%)`
                : backgroundDefault,
            fontWeight: t.bodyWeight ? parseInt(t.bodyWeight) : 400,
            lineHeight: t.lineHeight || 1.5,
            letterSpacing: t.letterSpacing || '0px',
          },
          'h1, h2, h3, h4, h5, h6': {
            fontFamily: t.headingFont
              ? `"${t.headingFont}", "Roboto", sans-serif`
              : (t.fontFamily ? `"${t.fontFamily}", "Roboto", sans-serif` : 'inherit'),
            fontWeight: t.headingWeight ? parseInt(t.headingWeight) : 700,
            letterSpacing: t.headingLetterSpacing || '0px',
          },
        },
      },
    },
  });

  const value = {
    settings,
    mode,        // 'ecommerce' | 'catalog'
    features,    // fully resolved feature map — use useFeature() to read individual flags
    lockedKeys,  // Tier 1 keys — use useIsFeatureLocked() to read
    loading,
    refreshSettings: fetchSettings,
  };

  // Inject custom CSS from admin settings
  useEffect(() => {
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
  }, [settings?.advanced?.customCSS]);

  // Inject custom Head & Body scripts from admin settings
  useEffect(() => {
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
  }, [settings?.advanced?.headScripts, settings?.advanced?.bodyScripts]);

  return (
    <SettingsContext.Provider value={value}>
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
    </SettingsContext.Provider>
  );
};
