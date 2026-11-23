import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '../../../pages/admin/SettingsPage';
import { SettingsContext } from '../../../context/ThemeContext';

const state = vi.hoisted(() => ({ features: { analytics: true, themes: true, seo: true }, mode: 'catalog' }));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
  useIsSuperAdmin: () => true,
}));
vi.mock('../../../hooks/useSettings', () => ({
  useMode: () => state.mode,
  useFeature: (key) => state.features[key] === true,
  useFeatureVisible: (key) => state.features[key] === true,
}));
vi.mock('../../../components/admin/settings/buildSettingsPanels', () => ({
  default: () => Array.from({ length: 13 }, (_, index) => index === 1
    ? [{ title: 'SEO & Search Engine Control', description: 'Search engine settings', keywords: ['seo'], content: <div>SEO panel</div> }]
    : []),
}));
vi.mock('../../../components/admin/settings/MfaSecurityPanel', () => ({ default: () => <div>Security panel</div> }));
vi.mock('../../../components/admin/settings/MessagingSettingsPanel', () => ({ default: () => <div>SMTP settings panel</div> }));
vi.mock('../../../components/admin/settings/InventoryAlertSettingsPanel', () => ({ default: () => null }));
vi.mock('../../../components/common/MediaPicker', () => ({ default: () => null }));
vi.mock('../../../components/admin/settings/LiveStorefrontPreview', () => ({ default: () => null }));
vi.mock('../../../components/admin/settings/CssVarsPanel', () => ({ default: () => null }));
vi.mock('../../../services/settingsService', () => ({ getAllSettings: vi.fn(async () => ({})) }));
vi.mock('../../../services/adminService', () => ({
  updateSettings: vi.fn(), getEmailTemplates: vi.fn(async () => ({ data: { data: [] } })),
  updateEmailTemplate: vi.fn(), sendTestEmail: vi.fn(), sendTestNotification: vi.fn(),
}));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify: vi.fn() }) }));

const view = () => <MemoryRouter><SettingsContext.Provider value={{ features: state.features, refreshSettings: vi.fn() }}><SettingsPage /></SettingsContext.Provider></MemoryRouter>;

describe('Settings Quick Find', () => {
  beforeEach(() => { state.features = { analytics: true, themes: true, seo: true }; state.mode = 'catalog'; });

  it('opens the SEO tab when searching from Store', async () => {
    render(view());
    const search = await screen.findByPlaceholderText('Search settings…');
    fireEvent.change(search, { target: { value: 'SEO' } });
    expect(screen.getByRole('tab', { name: 'SEO', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('SEO panel')).toBeInTheDocument();
  });

  it('opens Notifications when searching for SMTP settings', async () => {
    render(view());
    const search = await screen.findByPlaceholderText('Search settings…');
    fireEvent.change(search, { target: { value: 'SMTP' } });
    expect(screen.getByRole('tab', { name: 'Notifications', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('SMTP settings panel')).toBeInTheDocument();
  });
});
