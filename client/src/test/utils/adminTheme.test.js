import { describe, expect, it } from 'vitest';
import { buildAdminTheme } from '../../theme/adminTheme';
import { contrastRatio } from '../../utils/accessibility';
import { mixColor } from '../../utils/designTokens';

describe('admin appearance colors', () => {
  it('keeps brand, button, and interaction colors independent with readable foregrounds', () => {
    const theme = buildAdminTheme({ brandColor: '#ffee00', buttonColor: '#66ccff', stateColor: '#352080' });
    expect(theme.palette.primary.main).toBe('#ffee00');
    const button = theme.components.MuiButton.styleOverrides.containedPrimary;
    expect(button.backgroundColor).toBe('#66ccff');
    expect(button['&:hover'].backgroundColor).not.toBe('#352080');
    expect(theme.palette.adminSelection.main).toBe('#352080');
    expect(contrastRatio(button.color, button.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(button['&:hover'].color, button['&:hover'].backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(theme.palette.error.main).toBe('#dc3545');
  });

  it('falls back safely for malformed or missing saved colors', () => {
    expect(buildAdminTheme({ brandColor: 'invalid' }).palette.primary.main).toBe('#4f46e5');
    expect(buildAdminTheme(null).palette.primary.main).toBe('#4f46e5');
  });

  it('keeps outlined buttons visible when a pale button color is chosen', () => {
    const outlined = buildAdminTheme({ buttonColor: '#ffffff' }).components.MuiButton.styleOverrides.outlinedPrimary;
    expect(contrastRatio(outlined.borderColor, '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(outlined['&:hover'].borderColor, '#ffffff')).toBeGreaterThanOrEqual(3);
  });

  it('uses the focus color for form controls and preserves selected text contrast', () => {
    const theme = buildAdminTheme({ brandColor: '#0044aa', stateColor: '#777777' });
    expect(theme.components.MuiOutlinedInput.styleOverrides.root['&.Mui-focused .MuiOutlinedInput-notchedOutline'].borderColor).not.toBe('#0044aa');
    expect(theme.components.MuiCheckbox.styleOverrides.root['&.Mui-checked'].color).toBe('#777777');
    const selectedSurface = mixColor('#777777', '#ffffff', 0.86);
    expect(contrastRatio(theme.palette.adminSelection.main, selectedSurface)).toBeGreaterThanOrEqual(4.5);
    const tabInk = theme.components.MuiTab.styleOverrides.root['&.Mui-selected'].color;
    expect(contrastRatio(tabInk, selectedSurface)).toBeGreaterThanOrEqual(4.5);
    const focusedLabel = theme.components.MuiInputLabel.styleOverrides.root['&.Mui-focused'].color;
    expect(contrastRatio(focusedLabel, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(theme.components.MuiCheckbox.styleOverrides.root['&.Mui-checked'].color, '#ffffff')).toBeGreaterThanOrEqual(3);
  });

  it('follows the brand automatically until a button or selection override is saved', () => {
    const theme = buildAdminTheme({ brandColor: '#126443', buttonColor: '', stateColor: '' });
    expect(theme.components.MuiButton.styleOverrides.containedPrimary.backgroundColor).toBe('#126443');
    expect(theme.palette.adminSelection.main).toBe('#126443');
  });
});
