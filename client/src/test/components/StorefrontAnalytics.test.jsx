import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StorefrontAnalytics from '../../components/common/StorefrontAnalytics';

const state = vi.hoisted(() => ({ settings: {} }));
vi.mock('../../hooks/useSettings', () => ({ useSettings: () => state }));

function Navigation() {
  const navigate = useNavigate();
  return <>
    <button onClick={() => navigate('/products/seed')}>Product</button>
    <button onClick={() => navigate('/')}>Home</button>
    <button onClick={() => navigate('/admin/settings')}>Admin</button>
  </>;
}

const mount = (path = '/') => render(<StrictMode><MemoryRouter initialEntries={[path]}>
  <StorefrontAnalytics /><Navigation />
</MemoryRouter></StrictMode>);
const flush = () => act(() => vi.runOnlyPendingTimers());
const googleViews = () => (window.dataLayer || []).map((entry) => Array.from(entry)).filter((entry) => entry[0] === 'event' && entry[1] === 'page_view');
const pixelCommands = () => window.fbq?.queue || [];

beforeEach(() => {
  vi.useFakeTimers();
  state.settings = { seo: { googleAnalyticsId: 'G-ABC1234567', facebookPixelId: '123456789012345' } };
  delete window.__storefrontAnalytics;
  delete window.gtag;
  delete window.dataLayer;
  delete window.fbq;
  delete window._fbq;
});
afterEach(() => {
  vi.useRealTimers();
  document.querySelectorAll('script[data-store-tracker]').forEach((script) => script.remove());
  document.querySelectorAll('script[data-test-existing]').forEach((script) => script.remove());
  delete window['ga-disable-G-ABC1234567'];
  delete window['ga-disable-G-NEW1234567'];
});

describe('Storefront analytics integration', () => {
  it('loads the saved trackers once and sends one pageview through repeated effects', () => {
    const view = mount();
    flush();
    view.rerender(<StrictMode><MemoryRouter><StorefrontAnalytics /><Navigation /></MemoryRouter></StrictMode>);
    flush();
    expect(document.querySelectorAll('script[data-store-tracker]')).toHaveLength(2);
    expect(googleViews()).toHaveLength(1);
    expect(pixelCommands().filter((args) => args[0] === 'init')).toHaveLength(1);
    expect(pixelCommands().filter((args) => args[0] === 'trackSingle' && args[2] === 'PageView')).toHaveLength(1);
    const config = window.dataLayer.map((entry) => Array.from(entry)).find((entry) => entry[0] === 'config');
    expect(config[2].send_page_view).toBe(false);
  });

  it('tracks navigation and return visits, but does not count admin navigation', () => {
    mount(); flush();
    fireEvent.click(screen.getByText('Product')); flush();
    fireEvent.click(screen.getByText('Home')); flush();
    expect(googleViews()).toHaveLength(3);
    fireEvent.click(screen.getByText('Admin')); flush();
    expect(googleViews()).toHaveLength(3);
    expect(window['ga-disable-G-ABC1234567']).toBe(true);
  });

  it.each(['/admin/settings', '/?previewMode=1'])('does not initialize tracking at %s', (path) => {
    mount(path); flush();
    expect(document.querySelectorAll('script[data-store-tracker]')).toHaveLength(0);
    expect(googleViews()).toHaveLength(0);
  });

  it('waits for settings and ignores invalid IDs', () => {
    state.settings = null;
    const view = mount(); flush();
    expect(googleViews()).toHaveLength(0);
    state.settings = { seo: { googleAnalyticsId: '<script>', facebookPixelId: 'invalid' } };
    view.rerender(<StrictMode><MemoryRouter><StorefrontAnalytics /></MemoryRouter></StrictMode>); flush();
    expect(document.querySelectorAll('script[data-store-tracker]')).toHaveLength(0);
    state.settings = { seo: { googleAnalyticsId: 'G-ABC1234567' } };
    view.rerender(<StrictMode><MemoryRouter><StorefrontAnalytics /></MemoryRouter></StrictMode>); flush();
    expect(googleViews()).toHaveLength(1);
  });

  it('does not include query strings or fragments in Google page locations', () => {
    mount('/products?token=secret#private'); flush();
    expect(googleViews()[0][2].page_location).toBe(`${window.location.origin}/products`);
  });

  it('switches destinations when settings change and stops the removed Google destination', () => {
    const view = mount(); flush();
    state.settings = { seo: { googleAnalyticsId: 'G-NEW1234567', facebookPixelId: '987654321012345' } };
    view.rerender(<StrictMode><MemoryRouter><StorefrontAnalytics /><Navigation /></MemoryRouter></StrictMode>); flush();
    expect(window['ga-disable-G-ABC1234567']).toBe(true);
    expect(window['ga-disable-G-NEW1234567']).toBe(false);
    expect(googleViews().map((entry) => entry[2].send_to)).toEqual(['G-ABC1234567', 'G-NEW1234567']);
    expect(document.querySelectorAll('script[data-store-tracker]')).toHaveLength(2);
    expect(pixelCommands().filter((entry) => entry[0] === 'trackSingle').map((entry) => entry[1])).toEqual(['123456789012345', '987654321012345']);
    state.settings = { seo: {} };
    view.rerender(<StrictMode><MemoryRouter><StorefrontAnalytics /></MemoryRouter></StrictMode>); flush();
    expect(window['ga-disable-G-NEW1234567']).toBe(true);
    expect(googleViews()).toHaveLength(2);
  });

  it.each([
    ['https://connect.facebook.net/en_US/sdk.js', 2],
    ['https://connect.facebook.net/en_GB/fbevents.js', 1],
  ])('handles an existing Facebook script %s without confusing it with the pixel', (src, count) => {
    const script = document.createElement('script');
    script.src = src;
    script.dataset.testExisting = 'true';
    document.head.appendChild(script);
    mount(); flush();
    expect(document.querySelectorAll('script[data-store-tracker]')).toHaveLength(count);
    expect(pixelCommands().filter((entry) => entry[0] === 'trackSingle')).toHaveLength(1);
  });
});
