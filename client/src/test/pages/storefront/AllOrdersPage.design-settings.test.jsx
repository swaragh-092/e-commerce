import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AllOrdersPage from '../../../pages/storefront/AllOrdersPage';
import { orderService } from '../../../services/orderService';

const state = vi.hoisted(() => ({ settings: {} }));
vi.mock('../../../services/orderService', () => ({ orderService: { getMyOrders: vi.fn() } }));
vi.mock('../../../hooks/useSettings', () => ({
  useSettings: () => ({ settings: state.settings }),
  useCurrency: () => ({ formatPrice: value => String(value) }),
}));
vi.mock('../../../components/common/PageSEO', () => ({ default: () => null }));

const Location = () => <div data-testid="location">{useLocation().pathname}</div>;
const mount = () => render(<MemoryRouter><AllOrdersPage /><Location /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  state.settings = { ordersPage: {
    pageTitle: 'Purchase history', searchPlaceholder: 'Find a purchase',
    emptyHeadline: 'Nothing here yet', emptyMessage: 'Your purchases will appear here.',
    emptyCtaLabel: 'Explore the shop', emptyCtaLink: '/brands',
    showSupportInfo: true, supportTitle: 'Ask our team', supportMessage: 'We can help.',
    supportLinkLabel: 'Get help', supportLink: '/contact',
  } };
  orderService.getMyOrders.mockResolvedValue({ data: [], meta: { total: 0 } });
});

describe('Orders page design controls', () => {
  it('uses custom labels, help content and an internal empty-state recovery link', async () => {
    mount();
    expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
    expect(screen.getByText('Purchase history')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Find a purchase')).toBeInTheDocument();
    expect(screen.getByText('Your purchases will appear here.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get help' })).toHaveAttribute('href', '/contact');
    fireEvent.click(screen.getByRole('button', { name: 'Explore the shop' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/brands');
  });

  it('keeps filtered no-results copy separate from the empty-orders message', async () => {
    render(<MemoryRouter initialEntries={['/orders?status=cancelled']}><AllOrdersPage /></MemoryRouter>);
    expect(await screen.findByText('Try adjusting your search or filters.')).toBeInTheDocument();
    expect(screen.queryByText('Your purchases will appear here.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear Filters' })).toBeInTheDocument();
  });

  it('rejects external recovery links and can hide the help block', async () => {
    state.settings.ordersPage.emptyCtaLink = '//outside.test';
    state.settings.ordersPage.showSupportInfo = false;
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Explore the shop' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/products');
    expect(screen.queryByText('Ask our team')).not.toBeInTheDocument();
  });
});
