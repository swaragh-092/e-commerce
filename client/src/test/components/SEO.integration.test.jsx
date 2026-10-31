import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsContext } from '../../context/ThemeContext';
import SEO from '../../components/common/SEO';
import PageSEO from '../../components/common/PageSEO';
import { seoService } from '../../services/seoService';

const settings = { general: { storeName: 'Shop' }, seo: { canonicalBaseUrl: 'https://shop.test' } };
vi.mock('../../hooks/useSettings', () => ({
  useFeature: () => true,
  useSettings: () => ({ settings: { general: { storeName: 'Shop' }, seo: { canonicalBaseUrl: 'https://shop.test' } } }),
}));
vi.mock('../../services/seoService', () => ({ seoService: { getMetadata: vi.fn() } }));

function Page() {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <PageSEO title={location.pathname.endsWith('one') ? 'Fallback one' : 'Fallback two'} type="product" />
    {/* Global resolved metadata follows the page fallback, as in StoreLayout. */}
    <SEO />
    <button onClick={() => navigate('/products/two')}>Next product</button>
  </>;
}
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { document.head.querySelectorAll('[data-rh]').forEach((node) => node.remove()); });

describe('resolved SEO metadata across storefront navigation', () => {
  it('honors URL overrides and removes the old route metadata while the next request is pending', async () => {
    let resolveNext;
    seoService.getMetadata.mockResolvedValueOnce({ title: 'Override one', type: 'product', canonicalUrl: 'https://shop.test/products/one', noIndex: true })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNext = resolve; }));
    render(<HelmetProvider><SettingsContext.Provider value={{ settings }}>
      <MemoryRouter initialEntries={['/products/one']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Page /></MemoryRouter>
    </SettingsContext.Provider></HelmetProvider>);
    await waitFor(() => expect(document.title).toBe('Override one | Shop'));
    expect(document.querySelector('meta[name="robots"]').content).toBe('noindex, nofollow');
    fireEvent.click(screen.getByText('Next product'));
    await waitFor(() => expect(document.title).toBe('Fallback two | Shop'));
    await act(async () => resolveNext({ title: 'Override two', type: 'product', canonicalUrl: 'https://shop.test/products/two', noIndex: false }));
    await waitFor(() => expect(document.title).toBe('Override two | Shop'));
    expect(document.querySelector('meta[name="robots"]').content).toBe('index, follow');
    expect(document.querySelector('link[rel="canonical"]').href).toBe('https://shop.test/products/two');
  });
});
