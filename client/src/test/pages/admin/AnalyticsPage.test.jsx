import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsPage from '../../../pages/admin/AnalyticsPage';
import { getCatalogOverview, getTopProducts, getProductFunnel } from '../../../services/adminService';

const actor = vi.hoisted(() => ({ mode: 'catalog', orders: false, id: 'staff-1', orderPermission: true, analytics: true }));
vi.mock('../../../hooks/useSettings', () => ({
  useSettings: () => ({ mode: actor.mode, features: { analytics: actor.analytics, orders: actor.orders, coupons: true } }),
  useCurrency: () => ({ formatPrice: (value) => `$${value}` }),
}));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: actor.id }, hasPermission: (permission) => permission !== 'orders.read' || actor.orderPermission }) }));
vi.mock('../../../services/adminService', async (original) => {
  const service = await original();
  return Object.fromEntries(Object.keys(service).map((key) => [key, vi.fn().mockResolvedValue({ data: { data: [] } })]));
});

beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  Object.assign(actor, { mode: 'catalog', orders: false, id: 'staff-1', orderPermission: true, analytics: true });
  getCatalogOverview.mockResolvedValue({ data: { data: { visits: 12, sessions: 4, productViews: 8, trackingAvailable: true,
    topViews: [{ id: 'p1', name: 'Apples', views: 8 }], trafficSources: [], campaigns: [], trend: [] } } });
});

describe('Analytics in Catalog mode', () => {
  it('loads traffic reports without calling sales APIs', async () => {
    render(<AnalyticsPage />);
    expect(await screen.findByText('Apples')).toBeInTheDocument();
    expect(getCatalogOverview).toHaveBeenCalledWith({ period: '30d' });
    expect(getTopProducts).not.toHaveBeenCalled();
    expect(screen.queryByText('Top Selling Products')).not.toBeInTheDocument();
  });

  it('saves hidden cards and columns, restores them, and isolates staff preferences', async () => {
    const view = render(<AnalyticsPage />);
    await screen.findByText('Apples');
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Sessions', exact: true }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Most viewed products: Views' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText('Sessions', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Views', exact: true })).not.toBeInTheDocument();
    view.unmount();
    const restored = render(<AnalyticsPage />);
    await screen.findByText('Apples');
    expect(screen.queryByText('Sessions', { exact: true })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore defaults' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Sessions', { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Views', exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('checkbox', { name: 'Sessions', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    restored.unmount();
    actor.id = 'staff-2'; render(<AnalyticsPage />);
    expect(await screen.findByText('Sessions', { exact: true })).toBeInTheDocument();
  });

  it('uses traffic-only reports for staff without order permission in Ecommerce too', async () => {
    Object.assign(actor, { mode: 'ecommerce', orders: true, orderPermission: false });
    render(<AnalyticsPage />);
    await screen.findByText('Apples');
    expect(getTopProducts).not.toHaveBeenCalled();
  });

  it('does not fetch when Analytics is disabled', () => {
    actor.analytics = false; render(<AnalyticsPage />);
    expect(screen.getByText('Analytics is disabled in Platform Features.')).toBeInTheDocument();
    expect(getCatalogOverview).not.toHaveBeenCalled();
  });

  it('shows a retry action when the report fails to load', async () => {
    getCatalogOverview.mockRejectedValueOnce(new Error('Network error'));
    render(<AnalyticsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load analytics.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Apples')).toBeInTheDocument();
  });

  it('customizes sales cards and table columns without refetching hidden reports', async () => {
    Object.assign(actor, { mode: 'ecommerce', orders: true });
    getProductFunnel.mockResolvedValue({ data: { data: [{ productId: 'p1', name: 'Apples', views: 8, addToCart: 2, purchased: 1 }] } });
    render(<AnalyticsPage />);
    await screen.findByText('Apples');
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Top selling products', exact: true }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Product funnel: Views' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Top Selling Products' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Views', exact: true })).not.toBeInTheDocument();
    getTopProducts.mockClear();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Compare' }));
    await waitFor(() => expect(getProductFunnel).toHaveBeenCalledWith(expect.objectContaining({ compare: true })));
    expect(getTopProducts).not.toHaveBeenCalled();
    expect(getCatalogOverview).not.toHaveBeenCalled();
  });
});
