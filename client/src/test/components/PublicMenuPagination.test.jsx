import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Sidebar from '../../components/layout/StorefrontSidebarMenu';
import Footer from '../../components/layout/StorefrontFooter';
import StoreLayout from '../../layouts/StoreLayout';
import MenuService from '../../services/menuService';
vi.mock('../../services/menuService', () => ({ default: { getPublicMenu: vi.fn(), getPublicMenuChildren: vi.fn() } }));
vi.mock('../../hooks/useSettings', () => ({
  useSettings: () => ({ settings: { general: { storeName: 'Shop' } }, features: {} }),
  useCurrency: () => ({ formatPrice: String }), useFeature: () => false, useFeatureVisible: () => false,
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, hasAnyPermission: () => false }) }));
vi.mock('../../hooks/useCart', () => ({ useCart: () => ({ cartCount: 0 }) }));
vi.mock('../../context/WishlistContext', () => ({ useWishlist: () => ({ wishlistCount: 0 }) }));
vi.mock('../../context/CategoryContext', () => ({ useCategories: () => ({ error: null }) }));
vi.mock('../../components/layout/CategoryNav', () => ({ default: () => null }));
vi.mock('../../components/layout/DarkModeToggle', () => ({ default: () => null }));
vi.mock('../../components/search/SearchWidget', () => ({ default: () => null }));
vi.mock('../../components/common/SEO', () => ({ default: () => null }));
vi.mock('../../components/common/StorefrontAnalytics', () => ({ default: () => null }));
const child = id => ({ id, menuId: 'menu', label: id, targetType: 'custom_url', url: `/${id}`, children: [] });
const first = { id: 'menu', items: [{ ...child('Products'), targetType: 'none', children: [child('Apple')], childrenPagination: { limit: 1, nextOffset: 1, hasMore: true } }] };
const next = { data: { items: [child('Berry')], pagination: { offset: 1, limit: 1, nextOffset: null, hasMore: false } } };
beforeEach(() => {
  vi.clearAllMocks();
  MenuService.getPublicMenu.mockResolvedValue({ data: first });
  MenuService.getPublicMenuChildren.mockResolvedValue(next);
});
describe('public menu pagination integration', () => {
  it.each([['sidebar', Sidebar], ['footer', Footer]])('reveals the next child in the %s without navigating', async (_, Component) => {
    render(<MemoryRouter><Component /></MemoryRouter>);
    await screen.findByRole('link', { name: 'Apple' });
    expect(screen.queryByRole('link', { name: 'Berry' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show more Products' }));
    expect(await screen.findByRole('link', { name: 'Berry' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Apple' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show more Products' })).not.toBeInTheDocument();
  });
  it.each(['desktop', 'mobile'])('loads additional children inside the %s navigation', async surface => {
    MenuService.getPublicMenu.mockImplementation(async location => ({ data: location === 'header' ? first : null }));
    render(<MemoryRouter><StoreLayout /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: surface === 'desktop' ? 'Products' : 'Open navigation menu' }));
    const more = await screen.findByRole('menuitem', { name: 'Show more Products' });
    expect(screen.queryByRole('menuitem', { name: 'Berry' })).not.toBeInTheDocument();
    fireEvent.click(more);
    expect(await screen.findByRole('menuitem', { name: 'Berry' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Apple' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Show more Products' })).not.toBeInTheDocument());
  });
});
