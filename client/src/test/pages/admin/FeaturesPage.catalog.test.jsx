import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FeaturesPage from '../../../pages/admin/FeaturesPage';
import { SettingsContext } from '../../../context/ThemeContext';
import { updateSettings } from '../../../services/adminService';
import { getAllSettings } from '../../../services/settingsService';
const { notify, refreshSettings, actor } = vi.hoisted(() => ({ notify: vi.fn(), refreshSettings: vi.fn(), actor: { superAdmin: true } }));
vi.mock('../../../services/adminService', () => ({ updateSettings: vi.fn() }));
vi.mock('../../../services/settingsService', () => ({ getAllSettings: vi.fn(), default: {} }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify }) }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }), useIsSuperAdmin: () => actor.superAdmin }));
vi.mock('../../../hooks/useSettings', () => ({ useMode: () => 'ecommerce' }));
const view = () => render(<SettingsContext.Provider value={{ refreshSettings, features: {} }}><FeaturesPage /></SettingsContext.Provider>);
beforeEach(() => { vi.clearAllMocks(); actor.superAdmin = true; getAllSettings.mockResolvedValue({ general: { mode: 'ecommerce' }, features: { newsletter: true, gallery: true, blogs: true } }); updateSettings.mockResolvedValue({}); });
describe('Platform optional feature catalog', () => {
  it('renders and saves independent content and Customers switches', async () => {
    view();
    await waitFor(() => expect(getAllSettings).toHaveBeenCalled());
    for (const label of ['Newsletter', 'Gallery', 'Blogs', 'Pages', 'Customers']) {
      const control = screen.getByRole('checkbox', { name: label, exact: true });
      await waitFor(() => expect(control).toBeChecked()); fireEvent.click(control);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save Platform Features' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Save Features' }));
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith(expect.arrayContaining(
      ['newsletter', 'gallery', 'blogs', 'pages', 'customers'].map((key) => ({ group: 'features', key, value: false }))
    )));
    expect(refreshSettings).toHaveBeenCalled();
  });
  it('keeps feature changes restricted to Super Admin', async () => {
    actor.superAdmin = false; view();
    await waitFor(() => expect(getAllSettings).toHaveBeenCalled());
    for (const name of ['Newsletter', 'Gallery', 'Blogs', 'Pages', 'Customers']) expect(screen.getByRole('checkbox', { name, exact: true })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save Platform Features' })).toBeDisabled();
  });
});

describe('Mode-locked capability visibility', () => {
  it('shows Catalog visibility switches locked off and restores saved preferences in E-commerce', async () => {
    getAllSettings.mockResolvedValue({
      general: { mode: 'catalog' },
      visibility: { adminPricing: true, storefrontPricing: false },
    });
    view();
    const pricingRow = screen.getByText('Pricing', { exact: true }).parentElement.parentElement;
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('CATALOG'));
    for (const label of ['Pricing', 'Cart', 'Checkout', 'Orders', 'Payments', 'Shipping']) {
      const row = screen.getByText(label, { exact: true }).parentElement.parentElement;
      expect(within(row).getByText('Locked OFF in Catalog mode')).toBeInTheDocument();
      for (const control of within(row).getAllByRole('checkbox')) {
        expect(control).not.toBeChecked();
        expect(control).toBeDisabled();
      }
    }
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'E-COMMERCE' }));
    await waitFor(() => expect(within(pricingRow).getByRole('checkbox', { name: /Show in Admin UI/ })).toBeEnabled());
    expect(within(pricingRow).getByRole('checkbox', { name: /Show in Admin UI/ })).toBeChecked();
    expect(within(pricingRow).getByRole('checkbox', { name: /Show in Storefront/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Save Platform Features' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Save Features' }));
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith(expect.arrayContaining([
      { group: 'visibility', key: 'adminPricing', value: true },
      { group: 'visibility', key: 'storefrontPricing', value: false },
    ])));
  });
});

describe('Store mode preview', () => {
  it('explains an unsaved mode change before applying it to the live store', async () => {
    view();
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Store mode' })).toHaveTextContent('E-COMMERCE'));
    expect(screen.getByRole('heading', { name: 'Core features' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Optional features' })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Store mode' }));
    fireEvent.click(screen.getByRole('option', { name: 'CATALOG' }));
    expect(screen.getByText('Unsaved mode change')).toBeInTheDocument();
    expect(screen.getByText(/Your live store changes only after you save/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Show in Admin UI: Pricing' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Show Product Prices', exact: true })).toBeDisabled();
    expect(updateSettings).not.toHaveBeenCalled();
  });
});
