import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AppRoutes from '../../routes/AppRoutes';

const auth = vi.hoisted(() => ({ permissions: [] }));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    loading: false,
    hasPermission: permission => auth.permissions.includes(permission),
    hasRole: () => false,
  }),
}));
vi.mock('../../hooks/useSettings', () => ({
  useFeatureVisible: () => true,
  useFeaturesResolved: () => true,
  useMode: () => 'ecommerce',
  useSettings: () => ({ features: {} }),
}));
vi.mock('../../layouts/AdminLayout', () => ({ default: () => <Outlet /> }));
vi.mock('../../layouts/StoreLayout', () => ({ default: () => <Outlet /> }));
vi.mock('../../pages/storefront/HomePage', () => ({ default: () => <h1>Store home</h1> }));
vi.mock('../../pages/admin/NotificationEventsPage', () => ({ default: () => <h1>Event notifications</h1> }));

describe('Notification route integration', () => {
  it.each([
    ['settings.read'],
    ['notifications.manage'],
    ['settings.read', 'notifications.manage'],
  ])('opens the event editor with permissions %j', async (...permissions) => {
    auth.permissions = permissions;
    render(<MemoryRouter initialEntries={['/admin/email-templates']}><AppRoutes /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Event notifications' })).toBeInTheDocument();
  });

  it('denies staff without either notification read permission', async () => {
    auth.permissions = ['products.read'];
    render(<MemoryRouter initialEntries={['/admin/email-templates']}><AppRoutes /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Store home' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Event notifications' })).not.toBeInTheDocument();
  });
});
