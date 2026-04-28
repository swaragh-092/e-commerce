import React, { createContext, useState, useEffect } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress } from '@mui/material';
import settingsService from '../services/settingsService';

export const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const data = await settingsService.getAllSettings();
      setSettings(data);
      applyDocumentSettings(data);
    } catch (error) {
      console.error("Failed to load settings", error);
      setSettings({
        theme: { primaryColor: '#1976d2', mode: 'light', fontFamily: 'Roboto' },
        general: { storeName: 'E-Commerce Store' },
        features: { wishlist: true, reviews: true, coupons: true, guestCheckout: true },
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

    // Google Font
    if (data?.theme?.fontFamily) {
      const fontName = data.theme.fontFamily.replace(/\s+/g, '+');
      const linkId = 'google-font-link';
      let link = document.getElementById(linkId);
      if (!link) {
        link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@300;400;500;600;700&display=swap`;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const t = settings?.theme || {};
  const radius = parseInt(t.borderRadius) || 8;

  const themeConfig = createTheme({
    palette: {
      mode: t.mode || 'light',
      primary: {
        main: t.primaryColor || '#1976d2',
      },
      secondary: {
        main: t.secondaryColor || '#9c27b0',
      },
      background: {
        default: t.backgroundColor || (t.mode === 'dark' ? '#121212' : '#f5f5f5'),
        paper: t.surfaceColor || (t.mode === 'dark' ? '#1e1e1e' : '#ffffff'),
      },
      text: {
        primary: t.textColor || (t.mode === 'dark' ? '#ffffff' : '#212121'),
      },
    },
    typography: {
      fontFamily: t.fontFamily
        ? `"${t.fontFamily}", "Roboto", "Helvetica", "Arial", sans-serif`
        : '"Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontSize: '2.5rem', fontWeight: 700 },
      h2: { fontSize: '2rem', fontWeight: 600 },
      button: { textTransform: 'none' },
    },
    shape: {
      borderRadius: radius,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: radius },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: radius + 4,
            boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { borderRadius: radius },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: radius },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': { borderRadius: radius },
          },
        },
      },
    },
  });

  const value = {
    settings,
    loading,
    refreshSettings: fetchSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      <ThemeProvider theme={themeConfig}>
        <CssBaseline />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
            <CircularProgress />
          </Box>
        ) : children}
      </ThemeProvider>
    </SettingsContext.Provider>
  );
};
