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

      // Update document title if store name changes
      if (data?.general?.storeName) {
          document.title = data.general.storeName;
      }

      // Load selected font from Google Fonts
      if (data?.theme?.fontFamily) {
        const fontName = data.theme.fontFamily.replace(/\s+/g, '+');
        const linkId = 'google-font-link';
        let link = document.getElementById(linkId);
        if (!link) {
          link = document.createElement('link');
          link.id = linkId;
          document.head.appendChild(link);
        }
        link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;600;700&display=swap`;
        link.rel = 'stylesheet';
      }
    } catch (error) {
      console.error("Failed to load settings", error);
      // Fallback settings mapping so app doesn't crash
      setSettings({
          theme: { primaryColor: '#1976d2', mode: 'light', fontFamily: 'Roboto' },
          general: { storeName: 'E-Commerce Store' },
          features: { wishlistEnabled: false, reviewsEnabled: false }
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const themeConfig = createTheme({
    palette: {
      mode: settings?.theme?.mode || 'light',
      primary: {
        main: settings?.theme?.primaryColor || '#1976d2',
      },
    },
    typography: {
      fontFamily: settings?.theme?.fontFamily ? `"${settings.theme.fontFamily}", "Roboto", "Helvetica", "Arial", sans-serif` : '"Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontSize: '2.5rem', fontWeight: 700 },
      h2: { fontSize: '2rem', fontWeight: 600 },
      button: { textTransform: 'none' }
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: parseInt(settings?.theme?.borderRadius) || 8 },
        },
      },
      MuiCard: {
          styleOverrides: {
              root: { borderRadius: (parseInt(settings?.theme?.borderRadius) || 8) + 4, boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)' }
          }
      }
    },
  });

  const value = {
    settings,
    loading,
    refreshSettings: fetchSettings
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
