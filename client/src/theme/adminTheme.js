import { createTheme } from '@mui/material/styles';
import { ensureContrast, mixColor, readableForeground, withAlpha } from '../utils/designTokens';

const ADMIN_PRIMARY = '#4f46e5';
const ADMIN_SAFETY_RED = '#dc3545';

/**
 * Stable admin theme with a small set of configurable brand controls.
 * Semantic status colors remain fixed so feedback keeps its usual meaning.
 */
export const buildAdminTheme = (settings = {}) => {
  const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
  const brandColor = color(settings?.brandColor, ADMIN_PRIMARY);
  const buttonColor = color(settings?.buttonColor, brandColor);
  const stateColor = color(settings?.stateColor, brandColor);
  const selectedSurface = mixColor(stateColor, '#ffffff', 0.86);
  const stateControlColor = ensureContrast(stateColor, '#ffffff', 3);
  const stateTextColor = ensureContrast(stateColor, '#ffffff');
  const buttonHover = mixColor(buttonColor, '#000000', 0.15);
  const buttonPressed = mixColor(buttonColor, '#000000', 0.25);
  const buttonInk = ensureContrast(buttonColor, '#ffffff');
  const buttonBorder = ensureContrast(buttonColor, '#ffffff', 3);
  const buttonForeground = readableForeground(buttonColor);
  const focusColor = ensureContrast(stateColor, '#ffffff', 3);

  return createTheme({
    palette: {
      adminSelection: { main: ensureContrast(stateColor, selectedSurface) },
      mode: 'light',
      primary: {
        main: brandColor,
        dark: mixColor(brandColor, '#000000', 0.2),
        light: mixColor(brandColor, '#ffffff', 0.72),
        lighter: mixColor(brandColor, '#ffffff', 0.72),
        contrastText: readableForeground(brandColor),
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
      action: {
        hover: withAlpha(stateColor, 0.08),
        selected: withAlpha(stateColor, 0.14),
        focus: withAlpha(stateColor, 0.18),
      },
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
            '&.Mui-focusVisible': {
              outline: `3px solid ${focusColor}`,
              outlineOffset: 2,
            },
            '&.Mui-selected': {
              backgroundColor: stateControlColor,
              color: readableForeground(stateControlColor),
              '&:hover': { backgroundColor: stateControlColor, color: readableForeground(stateControlColor) },
            },
          },
          containedPrimary: {
            backgroundColor: buttonColor,
            color: buttonForeground,
            '&:hover': { backgroundColor: buttonHover, color: readableForeground(buttonHover) },
            '&:active': { backgroundColor: buttonPressed, color: readableForeground(buttonPressed) },
          },
          outlinedPrimary: {
            color: buttonInk,
            borderColor: buttonBorder,
            '&:hover': {
              backgroundColor: withAlpha(buttonColor, 0.08),
              borderColor: buttonBorder,
              color: buttonInk,
            },
          },
          textPrimary: {
            color: buttonInk,
            '&:hover': { backgroundColor: withAlpha(buttonColor, 0.08), color: buttonInk },
          },
          containedError: {
            backgroundColor: ADMIN_SAFETY_RED,
            color: '#ffffff',
            '&:hover': { backgroundColor: '#b91c1c' },
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            '&.Mui-selected': {
              backgroundColor: stateControlColor,
              color: readableForeground(stateControlColor),
              '&:hover': { backgroundColor: stateControlColor, color: readableForeground(stateControlColor) },
            },
            '&.Mui-focusVisible': {
              outline: `3px solid ${focusColor}`,
              outlineOffset: 2,
            },
          },
        },
      },
      MuiButtonBase: {
        styleOverrides: {
          root: {
            '&.Mui-focusVisible': {
              outline: `3px solid ${focusColor}`,
              outlineOffset: 2,
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: focusColor,
              borderWidth: 2,
            },
          },
        },
      },
      MuiInput: {
        styleOverrides: {
          root: {
            '&.Mui-focused:after': { borderBottomColor: focusColor },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: { '&.Mui-focused': { color: stateTextColor } },
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            '&.Mui-checked': { color: stateControlColor },
            '&.Mui-focusVisible': { outline: `3px solid ${focusColor}`, outlineOffset: 1 },
          },
        },
      },
      MuiRadio: {
        styleOverrides: {
          root: {
            '&.Mui-checked': { color: stateControlColor },
            '&.Mui-focusVisible': { outline: `3px solid ${focusColor}`, outlineOffset: 1 },
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            '&.Mui-checked': {
              color: stateControlColor,
              '& + .MuiSwitch-track': { backgroundColor: stateControlColor },
            },
            '&.Mui-focusVisible': { outline: `3px solid ${focusColor}`, outlineOffset: 1 },
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            '&.Mui-selected': { color: ensureContrast(stateColor, selectedSurface) },
            '&.Mui-focusVisible': { outline: `3px solid ${focusColor}`, outlineOffset: -3 },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: { backgroundColor: stateControlColor },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
    },
  });
};

export const adminTheme = buildAdminTheme();
