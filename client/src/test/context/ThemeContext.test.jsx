import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { SettingsProvider, useDesignTokens } from '../../context/ThemeContext';

const settings = {
  theme: {
    primaryColor: '#2563eb',
    secondaryColor: '#ec4899',
    mode: 'light',
  },
  advanced: { customCSS: '.storefront-only { color: red; }' },
};

const { service } = vi.hoisted(() => ({
  service: {
    getAllSettings: vi.fn(),
    getFeatures: vi.fn(),
  },
}));

vi.mock('../../services/settingsService', () => ({
  default: service,
}));

const Probe = () => {
  const theme = useTheme();
  const { cssVariables, isAdminRoute, tokens } = useDesignTokens();
  return (
    <div
      data-testid="probe"
      data-admin={String(isAdminRoute)}
      data-has-vars={String(Object.keys(cssVariables).length > 0)}
      data-primary={tokens.colors.primary}
      data-ui-primary={theme.palette.primary.main}
    />
  );
};

const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <SettingsProvider>
      <Probe />
    </SettingsProvider>
  </MemoryRouter>
);

describe('SettingsProvider admin/storefront theme separation', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('style');
    document.getElementById('admin-custom-css')?.remove();
    document.getElementById('theme-critical-css')?.remove();
    service.getAllSettings.mockResolvedValue(settings);
    service.getFeatures.mockResolvedValue({ mode: 'ecommerce', features: {} });
  });

  it('uses the stable admin theme and skips storefront CSS on admin routes', async () => {
    renderAt('/admin/theme');

    const probe = await screen.findByTestId('probe');
    await waitFor(() => expect(probe.dataset.admin).toBe('true'));

    expect(probe.dataset.hasVars).toBe('false');
    expect(document.documentElement.style.getPropertyValue('--store-color-primary')).toBe('');
    expect(document.getElementById('admin-custom-css')).toBeNull();
  });

  it('applies merchant tokens and custom CSS on storefront routes', async () => {
    renderAt('/products/sample-product');

    const probe = await screen.findByTestId('probe');
    await waitFor(() => expect(probe.dataset.hasVars).toBe('true'));

    expect(probe.dataset.admin).toBe('false');
    expect(probe.dataset.primary).toBe('#2563eb');
    expect(document.documentElement.style.getPropertyValue('--store-color-primary')).toBe('#2563eb');
    expect(document.getElementById('admin-custom-css')?.textContent).toContain('storefront-only');
  });

  it('uses saved admin colors without changing storefront tokens', async () => {
    service.getAllSettings.mockResolvedValue({ ...settings, admin: { brandColor: '#126443' } });
    renderAt('/admin/settings');
    const probe = await screen.findByTestId('probe');
    await waitFor(() => expect(probe.dataset.uiPrimary).toBe('#126443'));
    expect(probe.dataset.primary).toBe('#2563eb');
    expect(probe.dataset.hasVars).toBe('false');
  });
});
