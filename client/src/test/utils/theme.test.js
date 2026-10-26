import { describe, expect, it } from 'vitest';
import {
  buildStorefrontCssVariables,
  buildStorefrontTheme,
  resolveStorefrontThemeState,
} from '../../utils/theme';

describe('theme and button color system', () => {
  describe('resolveStorefrontThemeState', () => {
    it('defaults error/danger color to standard safety red #dc3545', () => {
      const state = resolveStorefrontThemeState({});
      expect(state.errorColor).toBe('#dc3545');
      expect(state.buttonStyle).toBe('solid');
      expect(state.radius).toBe(8);
    });

    it('honors admin-configured primary, secondary, and button style', () => {
      const state = resolveStorefrontThemeState({
        primaryColor: '#6366f1',
        secondaryColor: '#ec4899',
        buttonStyle: 'pill',
        borderRadius: '16',
      });
      expect(state.primaryMain).toBe('#6366f1');
      expect(state.secondaryMain).toBe('#ec4899');
      expect(state.buttonStyle).toBe('pill');
      expect(state.radius).toBe(16);
      expect(state.errorColor).toBe('#dc3545');
    });
  });

  describe('buildStorefrontCssVariables', () => {
    it('emits button semantic tokens with safety red for danger', () => {
      const vars = buildStorefrontCssVariables({
        primaryColor: '#0f766e',
        secondaryColor: '#f97316',
        buttonStyle: 'solid',
      });

      expect(vars['--store-btn-danger-bg']).toBe('#dc3545');
      expect(vars['--store-btn-primary-bg']).toBe('#0f766e');
      expect(vars['--store-btn-secondary-bg']).toBe('#f97316');
      expect(vars['--store-btn-success-bg']).toBe('#059669');
      expect(vars['--store-btn-warning-bg']).toBe('#d97706');
      expect(vars['--store-btn-info-bg']).toBe('#0284c7');
    });

    it('sets pill radius when buttonStyle is pill', () => {
      const vars = buildStorefrontCssVariables({
        buttonStyle: 'pill',
      });
      expect(vars['--store-btn-radius']).toBe('9999px');
      expect(vars['--store-style-button']).toBe('pill');
    });
  });

  describe('buildStorefrontTheme', () => {
    it('creates palette containing all semantic colors and extended light/dark tokens', () => {
      const theme = buildStorefrontTheme({
        primaryColor: '#2563eb',
        secondaryColor: '#64748b',
      });

      expect(theme.palette.primary.main).toBe('#2563eb');
      expect(theme.palette.secondary.main).toBe('#64748b');
      expect(theme.palette.error.main).toBe('#dc3545');
      expect(theme.palette.success.main).toBe('#059669');
      expect(theme.palette.warning.main).toBe('#d97706');
      expect(theme.palette.info.main).toBe('#0284c7');
      expect(theme.palette.light.main).toBe('#f8fafc');
      expect(theme.palette.dark.main).toBe('#212529');
    });

    it('configures MuiButton with safety red for containedError and delete actions', () => {
      const theme = buildStorefrontTheme({
        buttonStyle: 'solid',
        borderRadius: '10',
      });

      const buttonOverrides = theme.components.MuiButton.styleOverrides;
      expect(buttonOverrides.root.borderRadius).toBe(10);
      expect(buttonOverrides.root.textTransform).toBe('none');

      // Error / Danger button is strictly RED
      expect(buttonOverrides.containedError.backgroundColor).toBe('#dc3545');
      expect(buttonOverrides.containedError.color).toBe('#ffffff');
      expect(buttonOverrides.containedError['&:hover'].backgroundColor).toBe('#b91c1c');

      // Success is Green
      expect(buttonOverrides.containedSuccess.backgroundColor).toBe('#059669');
      // Warning is Amber
      expect(buttonOverrides.containedWarning.backgroundColor).toBe('#d97706');
      // Info is Cyan
      expect(buttonOverrides.containedInfo.backgroundColor).toBe('#0284c7');
    });

    it('keeps destructive buttons on fixed Safety Red even when errorColor token is customized', () => {
      const theme = buildStorefrontTheme({
        errorColor: '#8b5cf6', // custom error token
      });

      // Palette error main reflects the custom token for state text / alerts
      expect(theme.palette.error.main).toBe('#8b5cf6');

      const buttonOverrides = theme.components.MuiButton.styleOverrides;
      // Destructive button overrides remain strictly locked to fixed Safety Red (#dc3545)
      expect(buttonOverrides.containedError.backgroundColor).toBe('#dc3545');
      expect(buttonOverrides.containedError['&:hover'].backgroundColor).toBe('#b91c1c');
      expect(buttonOverrides.outlinedError.borderColor).toBe('#dc3545');
      expect(buttonOverrides.outlinedError.color).toBe('#dc3545');
      expect(buttonOverrides.textError.color).toBe('#dc3545');

      const vars = buildStorefrontCssVariables({
        errorColor: '#8b5cf6',
      });
      expect(vars['--store-btn-danger-bg']).toBe('#dc3545');
      expect(vars['--store-btn-danger-hover']).toBe('#b91c1c');
    });

    it('honors admin-configured cancelButtonColor for outlined and text cancel buttons while keeping containedError red', () => {
      const theme = buildStorefrontTheme({
        cancelButtonColor: '#e11d48',
      });

      const buttonOverrides = theme.components.MuiButton.styleOverrides;
      expect(buttonOverrides.containedError.backgroundColor).toBe('#dc3545'); // Destructive remains Safety Red
      expect(buttonOverrides.outlinedError.borderColor).toBe('#e11d48');
      expect(buttonOverrides.outlinedError.color).toBe('#e11d48');
      expect(buttonOverrides.textError.color).toBe('#e11d48');

      const vars = buildStorefrontCssVariables({
        cancelButtonColor: '#e11d48',
      });
      expect(vars['--store-btn-cancel-border']).toBe('#e11d48');
      expect(vars['--store-btn-cancel-text']).toBe('#e11d48');
    });

    it('configures outline and soft buttonStyle for Primary and Secondary buttons', () => {
      const themeOutline = buildStorefrontTheme({
        primaryColor: '#4f46e5',
        secondaryColor: '#0ea5e9',
        buttonStyle: 'outline',
      });

      const outlineOverrides = themeOutline.components.MuiButton.styleOverrides;
      expect(outlineOverrides.containedPrimary.background).toBe('transparent');
      expect(outlineOverrides.containedPrimary.color).toBe('#4f46e5');
      expect(outlineOverrides.containedPrimary.border).toBe('1px solid #4f46e5');

      const themeSoft = buildStorefrontTheme({
        primaryColor: '#4f46e5',
        buttonStyle: 'soft',
      });

      const softOverrides = themeSoft.components.MuiButton.styleOverrides;
      expect(softOverrides.containedPrimary.backgroundColor).toBe('#4f46e522');
      expect(softOverrides.containedPrimary.color).toBe('#4f46e5');
    });

    it('sets 9999px border radius for pill buttonStyle', () => {
      const themePill = buildStorefrontTheme({
        buttonStyle: 'pill',
      });
      expect(themePill.components.MuiButton.styleOverrides.root.borderRadius).toBe(9999);
    });

    it('registers custom variants for light, dark, and link in MuiButton', () => {
      const theme = buildStorefrontTheme({});
      const variants = theme.components.MuiButton.variants;

      const lightVariant = variants.find((v) => v.props.color === 'light');
      expect(lightVariant).toBeDefined();

      const darkVariant = variants.find((v) => v.props.color === 'dark');
      expect(darkVariant).toBeDefined();

      const linkVariant = variants.find((v) => v.props.variant === 'link');
      expect(linkVariant).toBeDefined();
      expect(linkVariant.style.background).toBe('transparent');
      expect(linkVariant.style['&:hover'].textDecoration).toBe('underline');
    });
  });
});
