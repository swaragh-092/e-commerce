import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  it('renders and saves independent Newsletter, Gallery, Blogs, and Pages switches', async () => {
    view();
    await waitFor(() => expect(getAllSettings).toHaveBeenCalled());
    for (const label of ['Newsletter', 'Gallery', 'Blogs', 'Pages']) {
      const control = screen.getByRole('checkbox', { name: label, exact: true });
      await waitFor(() => expect(control).toBeChecked()); fireEvent.click(control);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save Platform Features' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Save Features' }));
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith(expect.arrayContaining(
      ['newsletter', 'gallery', 'blogs', 'pages'].map((key) => ({ group: 'features', key, value: false }))
    )));
    expect(refreshSettings).toHaveBeenCalled();
  });
  it('keeps feature changes restricted to Super Admin', async () => {
    actor.superAdmin = false; view();
    await waitFor(() => expect(getAllSettings).toHaveBeenCalled());
    for (const name of ['Newsletter', 'Gallery', 'Blogs', 'Pages']) expect(screen.getByRole('checkbox', { name, exact: true })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save Platform Features' })).toBeDisabled();
  });
});
