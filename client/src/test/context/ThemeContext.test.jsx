import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useContext } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { SettingsContext, SettingsProvider, useDesignTokens } from '../../context/ThemeContext';

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

  it('applies draft settings for multiple pages without reloading the preview', async () => {
    const initialUrl = window.location.href;
    const parent = document.createElement('iframe');
    document.body.append(parent);
    const parentMock = vi.spyOn(window, 'parent', 'get').mockReturnValue(parent.contentWindow);
    window.history.replaceState(null, '', '/products/sample?previewMode=1');
    localStorage.setItem('storePreviewTheme', JSON.stringify(settings));
    const SettingsProbe = () => (
      <output data-testid="page-settings">{JSON.stringify(useContext(SettingsContext).settings)}</output>
    );
    const updated = {
      ...settings,
      productPage: { showBreadcrumbs: false, showSKU: false, showStockBadge: false, addToCartLabel: 'Add to basket' },
      categoryPage: { headerLayout: 'split' },
      catalog: { gridColumns: 3 },
      homepage: { sections: [] },
      blogPage: { showAuthor: false },
      brandsPage: { heroTitle: 'Our brands' },
      cartPage: { emptyStateText: 'Your basket is empty' },
      accountPage: { showSupportInfo: true },
      checkoutPage: { paymentHeading: 'Payment options' },
      searchPage: { showResultCount: false },
      ordersPage: { emptyHeadline: 'No purchases yet' },
      notFoundPage: { headline: 'Page unavailable' },
    };
    try {
      render(<MemoryRouter><SettingsProvider><SettingsProbe /></SettingsProvider></MemoryRouter>);
      await screen.findByTestId('page-settings');
      const send = (source, origin) => act(() => window.dispatchEvent(new MessageEvent('message', {
        origin, source, data: { type: 'PREVIEW_SETTINGS_UPDATE', settings: updated },
      })));
      send(window, window.location.origin);
      expect(JSON.parse(screen.getByTestId('page-settings').textContent)).toEqual(settings);
      send(parent.contentWindow, 'https://other.example');
      expect(JSON.parse(screen.getByTestId('page-settings').textContent)).toEqual(settings);
      send(parent.contentWindow, window.location.origin);
      expect(JSON.parse(screen.getByTestId('page-settings').textContent)).toEqual(updated);
    } finally {
      window.history.replaceState(null, '', initialUrl);
      parentMock.mockRestore();
      parent.remove();
    }
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
