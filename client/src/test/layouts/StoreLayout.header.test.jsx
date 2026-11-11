import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  settings: {
    nav: {
      logoUrl: '/designer-logo.svg',
      logoText: 'Designer Store',
      logoMaxWidth: '220px',
      showStoreName: true,
      showMenu: true,
    },
    logo: { main: '/global-logo.svg' },
    theme: {},
    announcement: { enabled: false },
  },
  menuItems: [{ id: 'shop', label: 'Shop', url: '/products', targetType: 'page', placement: 'center' }],
}));

vi.mock('../../hooks/useSettings', () => ({
  useSettings: () => ({ settings: state.settings, features: { pages: true } }),
  useFeature: () => true,
  useFeatureVisible: () => true,
  useCurrency: () => ({ formatPrice: () => '$0' }),
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, logout: vi.fn(), hasAnyPermission: () => false, user: null }) }));
vi.mock('../../hooks/useCart', () => ({ useCart: () => ({ cartCount: 0 }) }));
vi.mock('../../context/WishlistContext', () => ({ useWishlist: () => ({ wishlistCount: 0 }) }));
vi.mock('../../context/CategoryContext', () => ({ useCategories: () => ({ error: null }) }));
vi.mock('../../services/menuService', () => ({
  default: { getPublicMenu: async () => ({ data: { items: state.menuItems } }) },
}));
vi.mock('../../services/pageService', () => ({ default: { getPublicPages: async () => ({ data: [] }) } }));
vi.mock('../../components/layout/CategoryNav', () => ({ default: () => null }));
vi.mock('../../components/layout/StorefrontFooter', () => ({ default: () => null }));
vi.mock('../../components/layout/DarkModeToggle', () => ({ default: () => null }));
vi.mock('../../components/search/SearchWidget', () => ({ default: () => null }));
vi.mock('../../components/common/SEO', () => ({ default: () => null }));
vi.mock('../../components/common/StorefrontAnalytics', () => ({ default: () => null }));

import StoreLayout from '../../layouts/StoreLayout';

const renderStoreLayout = () => render(
  <MemoryRouter initialEntries={['/']}>
    <Routes>
      <Route path="/" element={<StoreLayout />}><Route index element={<div>Store page</div>} /></Route>
    </Routes>
  </MemoryRouter>,
);

describe('StoreLayout responsive header settings', () => {
  beforeEach(() => {
    state.settings.nav = {
      logoUrl: '/designer-logo.svg',
      logoText: 'Designer Store',
      logoMaxWidth: '220px',
      showStoreName: true,
      showMenu: true,
    };
  });

  it('uses Designer logo settings and renders both desktop and mobile menu controls', async () => {
    const { container } = renderStoreLayout();
    await waitFor(() => expect(container.querySelector('nav[aria-label="Main navigation"]')).toBeInTheDocument());

    expect(container.querySelector('img[src="/designer-logo.svg"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/global-logo.svg"]')).not.toBeInTheDocument();
    expect(screen.getByText('Designer Store')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeInTheDocument();
    expect(container.querySelector('nav[aria-label="Main navigation"]')).toBeInTheDocument();
  });

  it('allows the mobile logo and image to shrink around the header actions', async () => {
    state.settings.nav.logoText = 'A very long designer store name';
    const { container } = renderStoreLayout();
    const menu = await screen.findByRole('button', { name: 'Open navigation menu' });
    const logo = screen.getByRole('link', { name: state.settings.nav.logoText });
    const image = container.querySelector('img[src="/designer-logo.svg"]');

    expect(menu).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Register' })).toBeInTheDocument();
    expect(logo).toHaveStyle('flex-shrink: 1; min-width: 0');
    expect(image).toHaveStyle('flex-shrink: 1; min-width: 0');
  });

  it('hides desktop links and the mobile menu trigger when the Designer hides the menu', async () => {
    state.settings.nav.showMenu = false;
    const { container } = renderStoreLayout();
    await waitFor(() => expect(screen.getByText('Store page')).toBeInTheDocument());

    expect(container.querySelector('nav[aria-label="Main navigation"]')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).not.toBeInTheDocument();
  });
});
