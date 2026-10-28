import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '../../../pages/admin/SettingsPage';
import { SettingsContext } from '../../../context/ThemeContext';
import { updateSettings } from '../../../services/adminService';
import { PERMISSIONS } from '../../../utils/permissions';

const state = vi.hoisted(() => ({ features: {}, mode: 'catalog', denied: [], superAdmin: true }));
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ hasPermission: permission => !state.denied.includes(permission) }),
  useIsSuperAdmin: () => state.superAdmin,
}));
vi.mock('../../../hooks/useSettings', () => ({
  useMode: () => state.mode,
  useFeature: key => state.features[key] === true,
  useFeatureVisible: key => state.features[key] === true,
  useSettings: () => ({ features: state.features, settings: {}, visibility: { admin: { cart: true } } }),
}));
vi.mock('../../../services/settingsService', () => ({
  getAllSettings: vi.fn(async () => ({ general: { storeName: 'Test Shop', mode: 'catalog' }, sku: { prefix: 'CAT' }, features: { themes: false }, visibility: { adminCart: true } })),
  default: {},
}));
vi.mock('../../../services/adminService', () => ({
  updateSettings: vi.fn(async () => ({})), getEmailTemplates: vi.fn(async () => ({ data: { data: [] } })),
  updateEmailTemplate: vi.fn(), sendTestEmail: vi.fn(),
}));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify: vi.fn() }) }));
vi.mock('../../../components/common/MediaPicker', () => ({ default: () => null }));
vi.mock('../../../components/admin/settings/LiveStorefrontPreview', () => ({ default: () => null }));
vi.mock('../../../components/admin/settings/SettingsPreviewPanel', () => ({ default: () => null }));
vi.mock('../../../components/admin/settings/MessagingSettingsPanel', () => ({ default: () => <div>Messaging settings</div> }));
vi.mock('../../../components/admin/settings/InventoryAlertSettingsPanel', () => ({ default: () => <div>Inventory alert configuration</div> }));
vi.mock('../../../components/admin/settings/CssVarsPanel', () => ({ default: () => null }));

const view = () => <MemoryRouter><SettingsContext.Provider value={{ features: state.features, refreshSettings: vi.fn() }}><SettingsPage /></SettingsContext.Provider></MemoryRouter>;
const openTab = name => fireEvent.click(screen.getByRole('tab', { name, exact: true }));
const designerLinks = () => Array.from(document.querySelectorAll('a[href^="/admin/store-designer"]'));

beforeEach(() => {
  vi.clearAllMocks();
  state.features = { themes: false, brands: false, blogs: false, newsletter: false, seo: false, productAssistant: false, apiBuilder: false, enquiry: true };
  state.mode = 'catalog'; state.denied = []; state.superAdmin = true;
});

describe('Settings follow platform features and permissions', () => {
  it('hides unavailable designer tabs and links while preserving catalog and menu operations', async () => {
    render(view());
    await screen.findByDisplayValue('Test Shop');
    for (const name of ['Branding', 'Homepage', 'SEO']) expect(screen.queryByRole('tab', { name, exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('Newsletter signup on account forms')).not.toBeInTheDocument();
    openTab('Layout');
    expect(screen.getByRole('link', { name: 'Manage published menu links' })).toHaveAttribute('href', '/admin/menus');
    expect(designerLinks()).toHaveLength(0);
    openTab('Catalog');
    expect(screen.getByDisplayValue('CAT')).toBeInTheDocument();
    expect(screen.queryByText('Brands Page', { exact: true })).not.toBeInTheDocument();
    expect(designerLinks()).toHaveLength(0);
    openTab('Advanced');
    for (const title of ['AI Product Assistant', 'API Builder', 'SEO & Discovery']) expect(screen.queryByText(title, { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open CSS editor' })).not.toBeInTheDocument();
  });

  it('restores enabled links, filters optional page editors, and falls back when the active tab disappears', async () => {
    state.features = { ...state.features, themes: true };
    const { rerender } = render(view());
    await screen.findByDisplayValue('Test Shop');
    openTab('Branding');
    expect(screen.getByRole('link', { name: 'Edit global design' })).toBeInTheDocument();
    openTab('Catalog');
    expect(screen.getByRole('link', { name: 'Edit product page' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit brands page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit blog pages' })).not.toBeInTheDocument();
    state.features = { ...state.features, brands: true, blogs: true };
    rerender(view());
    expect(screen.getByRole('link', { name: 'Edit brands page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit blog pages' })).toBeInTheDocument();
    openTab('Branding');
    state.features = { ...state.features, themes: false };
    rerender(view());
    expect(screen.getByRole('tab', { name: 'Store', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(designerLinks()).toHaveLength(0);
  });

  it('does not advertise edit tools or platform controls without the required permissions', async () => {
    state.features = { ...state.features, themes: true, seo: true, apiBuilder: true };
    state.denied = [PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.MENUS_READ]; state.superAdmin = false;
    render(view());
    await screen.findByDisplayValue('Test Shop');
    for (const name of ['Branding', 'Homepage', 'Layout']) expect(screen.queryByRole('tab', { name, exact: true })).not.toBeInTheDocument();
    openTab('SEO');
    expect(screen.queryByRole('link', { name: 'Platform Features' })).not.toBeInTheDocument();
    openTab('Advanced');
    expect(screen.queryByRole('link', { name: 'Platform Features' })).not.toBeInTheDocument();
    expect(designerLinks()).toHaveLength(0);
  });

  it('removes checkout destinations when their capabilities are disabled', async () => {
    state.mode = 'ecommerce';
    state.features = { ...state.features, themes: true, cart: true, checkout: true, shipping: true, payments: true, orders: true };
    const { rerender } = render(view());
    await screen.findByDisplayValue('Test Shop');
    openTab('Checkout');
    expect(screen.getByRole('link', { name: 'Edit cart page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage shipping' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Gateway Manager/ })).toBeInTheDocument();
    state.features = { ...state.features, cart: false, shipping: false, payments: false };
    rerender(view());
    expect(screen.queryByRole('link', { name: 'Edit cart page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Manage shipping' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open Gateway Manager/ })).not.toBeInTheDocument();
  });

  it('filters Notifications summaries by capabilities and avoids reverting platform switches on Save All', async () => {
    render(view());
    await screen.findByDisplayValue('Test Shop');
    openTab('Notifications');
    expect(screen.getByText('Welcome', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('New Enquiry — Staff', { exact: true })).toBeInTheDocument();
    expect(screen.queryByText('Order Placed', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('Inventory alert configuration')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save All' }));
    await waitFor(() => expect(updateSettings).toHaveBeenCalled());
    const payload = updateSettings.mock.calls[0][0];
    expect(payload).toContainEqual({ group: 'sku', key: 'prefix', value: 'CAT' });
    expect(payload.some(({ group, key }) => ['features', 'visibility'].includes(group) || (group === 'general' && key === 'mode'))).toBe(false);
  });
});
