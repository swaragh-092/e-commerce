import { createTheme } from '@mui/material/styles';

const ADMIN_PRIMARY = '#4f46e5';
const ADMIN_PRIMARY_DARK = '#3730a3';
const ADMIN_PRIMARY_LIGHT = '#e0e7ff';
const ADMIN_SAFETY_RED = '#dc3545';

/**
 * Stable admin theme.
 *
 * Admin chrome must never inherit merchant storefront design tokens. A saved
 * storefront theme may use any colours, radii, fonts, or button treatment; the
 * admin UI needs predictable contrast and hit targets regardless.
 */
export const adminTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: ADMIN_PRIMARY,
      dark: ADMIN_PRIMARY_DARK,
      light: ADMIN_PRIMARY_LIGHT,
      lighter: ADMIN_PRIMARY_LIGHT,
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#475569',
      dark: '#334155',
      light: '#e2e8f0',
      contrastText: '#ffffff',
    },
    error: {
      main: ADMIN_SAFETY_RED,
      dark: '#b91c1c',
      light: '#fecaca',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#d97706',
      dark: '#b45309',
      light: '#fef3c7',
      contrastText: '#1f2933',
    },
    success: {
      main: '#059669',
      dark: '#047857',
      light: '#d1fae5',
      contrastText: '#ffffff',
    },
    info: {
      main: '#0284c7',
      dark: '#0369a1',
      light: '#e0f2fe',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      disabled: '#94a3b8',
    },
    divider: 'rgba(15, 23, 42, 0.12)',
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          boxShadow: 'none',
          textTransform: 'none',
          backgroundImage: 'none',
          transition: 'background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease',
          '&:hover': { boxShadow: 'none' },
        },
        containedPrimary: {
          backgroundColor: ADMIN_PRIMARY,
          color: '#ffffff',
          '&:hover': { backgroundColor: ADMIN_PRIMARY_DARK },
        },
        containedError: {
          backgroundColor: ADMIN_SAFETY_RED,
          color: '#ffffff',
          '&:hover': { backgroundColor: '#b91c1c' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
  },
});
