import { describe, expect, it } from 'vitest';
import {
  BUTTON_APPEARANCES,
  BUTTON_ROLES,
  SAFETY_RED,
  buildColorCssVariables,
  buildMuiButtonStyleOverrides,
  contrastForState,
  getLegacyButtonAppearance,
  resolveButtonSx,
  resolveDesignTokens,
  readableForeground,
} from '../../utils/designTokens';
import { contrastRatio } from '../../utils/accessibility';

describe('shared storefront design tokens', () => {
  it.each(['#777777', '#767676', '#787878', '#ffffff', '#000000'])(
    'keeps solid button text readable at contrast boundary %s', (background) => {
      expect(contrastRatio(readableForeground(background), background)).toBeGreaterThanOrEqual(4.5);
      const tokens = resolveDesignTokens({ primaryColor: background });
      expect(contrastForState(tokens, 'primary', 'solid', 'default')).toBeGreaterThanOrEqual(4.5);
    }
  );
  it('resolves every role and appearance from the merchant brand colours', () => {
    const tokens = resolveDesignTokens({
      primaryColor: '#2563eb',
      secondaryColor: '#ec4899',
      surfaceColor: '#ffffff',
      textColor: '#111827',
      mode: 'light',
    });

    expect(tokens.colors.primary).toBe('#2563eb');
    expect(tokens.colors.secondary).toBe('#ec4899');
    BUTTON_ROLES.forEach((role) => {
      BUTTON_APPEARANCES.forEach((appearance) => {
        expect(tokens.buttons[role][appearance].default).toBeDefined();
        expect(tokens.buttons[role][appearance].hover).toBeDefined();
        expect(tokens.buttons[role][appearance].pressed).toBeDefined();
        expect(tokens.buttons[role][appearance].focus).toBeDefined();
        expect(tokens.buttons[role][appearance].disabled).toBeDefined();
      });
    });
  });

  it('treats secondary as a neutral role while keeping MUI secondary branded', () => {
    const tokens = resolveDesignTokens({ secondaryColor: '#f97316', mode: 'light' });
    expect(tokens.colors.secondary).toBe('#f97316');
    expect(tokens.buttons.secondary.solid.default.bg).not.toBe('#f97316');
    expect(tokens.buttons.secondary.solid.default.bg).toBe(tokens.colors.neutral);
    expect(tokens.brandSecondary.solid.default.bg).toBe('#f97316');
    expect(tokens.defaultAppearance.secondary).toBe('outlined');
  });

  it('derives hover and pressed states from the primary brand colour', () => {
    const tokens = resolveDesignTokens({ primaryColor: '#2563eb', mode: 'light' });
    const primary = tokens.buttons.primary.solid;
    expect(primary.hover.bg).not.toBe(primary.default.bg);
    expect(primary.pressed.bg).not.toBe(primary.hover.bg);
    expect(tokens.colors.primaryHover).toBe(primary.hover.bg);
    expect(tokens.colors.primaryPressed).toBe(primary.pressed.bg);
  });

  it('keeps destructive solid buttons locked to Safety Red regardless of errorColor', () => {
    const tokens = resolveDesignTokens({ errorColor: '#8b5cf6', mode: 'light' });
    expect(tokens.colors.error).toBe('#8b5cf6');
    expect(tokens.buttons.danger.solid.default.bg).toBe(SAFETY_RED);
    expect(tokens.buttons.danger.solid.hover.bg).toBe('#b91c1c');
  });

  it('uses cancelButtonColor for outlined danger but not for solid danger', () => {
    const tokens = resolveDesignTokens({ cancelButtonColor: '#e11d48', mode: 'light' });
    expect(tokens.buttons.danger.solid.default.bg).toBe(SAFETY_RED);
    expect(tokens.buttons.danger.outlined.default.fg).toBe('#e11d48');
    expect(tokens.buttons.danger.outlined.default.border).toBe('#e11d48');
    expect(tokens.buttons.danger.text.default.fg).toBe('#e11d48');
  });

  it('maps the legacy buttonStyle into a default appearance', () => {
    expect(getLegacyButtonAppearance('outline')).toBe('outlined');
    expect(getLegacyButtonAppearance('soft')).toBe('soft');
    expect(getLegacyButtonAppearance('pill')).toBe('solid');
    expect(getLegacyButtonAppearance()).toBe('solid');
  });

  it('provides an on-image treatment with readable foregrounds', () => {
    const tokens = resolveDesignTokens({ primaryColor: '#facc15', mode: 'light' });
    BUTTON_APPEARANCES.forEach((appearance) => {
      const state = tokens.onImage[appearance].default;
      expect(state.bg).toBeDefined();
      expect(state.fg).toBeDefined();
    });
    expect(tokens.onImage.outlined.default.fg).toBe('#ffffff');
  });

  it('emits role/appearance/state CSS variables plus legacy aliases', () => {
    const tokens = resolveDesignTokens({ primaryColor: '#0f766e', mode: 'light' });
    const vars = buildColorCssVariables(tokens);

    expect(vars['--store-btn-primary-solid-bg']).toBe(tokens.buttons.primary.solid.default.bg);
    expect(vars['--store-btn-primary-solid-hover-bg']).toBe(tokens.buttons.primary.solid.hover.bg);
    expect(vars['--store-btn-primary-solid-pressed-bg']).toBe(tokens.buttons.primary.solid.pressed.bg);
    expect(vars['--store-btn-danger-outlined-text']).toBe(tokens.buttons.danger.outlined.default.fg);
    expect(vars['--store-btn-on-image-outlined-bg']).toBe(tokens.onImage.outlined.default.bg);
    expect(vars['--store-btn-primary-bg']).toBe(tokens.buttons.primary.solid.default.bg);
    expect(vars['--store-color-primary-hover']).toBe(tokens.buttons.primary.solid.hover.bg);
  });

  it('resolves forced states for the designer preview', () => {
    const tokens = resolveDesignTokens({ primaryColor: '#2563eb', mode: 'light' });
    const hoverSx = resolveButtonSx(tokens, 'primary', 'solid', { forcedState: 'hover' });
    const defaultSx = resolveButtonSx(tokens, 'primary', 'solid');
    const focusSx = resolveButtonSx(tokens, 'primary', 'solid', { forcedState: 'focus' });

    expect(hoverSx.backgroundColor).toBe(tokens.buttons.primary.solid.hover.bg);
    expect(hoverSx['&:hover']).toBeUndefined();
    expect(defaultSx['&:hover'].backgroundColor).toBe(tokens.buttons.primary.solid.hover.bg);
    expect(defaultSx['&:active'].backgroundColor).toBe(tokens.buttons.primary.solid.pressed.bg);
    expect(focusSx.boxShadow).toBe(tokens.buttons.primary.solid.focus.ring);
  });

  it('reports contrast for resolved button states', () => {
    const tokens = resolveDesignTokens({ primaryColor: '#0f766e', mode: 'light' });
    expect(contrastForState(tokens, 'primary', 'solid', 'default')).toBeGreaterThanOrEqual(4.5);
  });

  it('builds MUI overrides without fixed gradients and with themed roles', () => {
    const tokens = resolveDesignTokens({ primaryColor: '#2563eb', buttonStyle: 'solid', mode: 'light' });
    const { styleOverrides, variants } = buildMuiButtonStyleOverrides(tokens, { radius: 10, buttonStyle: 'solid' });

    expect(styleOverrides.root.backgroundImage).toBe('none');
    expect(styleOverrides.containedPrimary.backgroundColor).toBe(tokens.buttons.primary.solid.default.bg);
    expect(styleOverrides.containedPrimary.background).not.toContain('linear-gradient');
    expect(styleOverrides.containedError.backgroundColor).toBe(SAFETY_RED);
    expect(styleOverrides.containedSecondary.backgroundColor).toBe(tokens.brandSecondary.solid.default.bg);
    expect(styleOverrides.outlinedSecondary.backgroundColor).toBe('transparent');
    expect(styleOverrides.textNeutral.backgroundColor).toBe('transparent');
    expect(variants.find((variant) => variant.props.color === 'light').style.backgroundColor).toBe('#f8fafc');
    expect(variants.find((variant) => variant.props.color === 'dark').style.backgroundColor).toBe('#212529');
  });
});
