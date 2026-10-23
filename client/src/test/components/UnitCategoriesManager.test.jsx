import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UnitSettingsDialog from '../../components/admin/UnitSettingsDialog';
import { UnitCatalogProvider, useUnitCatalog } from '../../context/UnitCatalogContext';
import { STANDARD_UNITS } from '../../constants/units';
import settingsService from '../../services/settingsService';
import { NotificationProvider } from '../../context/NotificationContext';

vi.mock('../../services/settingsService', () => ({ default: {
  getSettingsGroup: vi.fn(), getUnitUsage: vi.fn(), updateSingleSetting: vi.fn(), updateSettingsBulk: vi.fn(),
} }));
const defaultCategories = [...new Set(STANDARD_UNITS.map((unit) => unit.category))];
const Probe = () => {
  const { units, categories } = useUnitCatalog();
  return <output data-testid="managed-state">{JSON.stringify({ units, categories })}</output>;
};
const state = () => JSON.parse(screen.getByTestId('managed-state').textContent);
const mount = () => render(<NotificationProvider><UnitCatalogProvider><Probe /><UnitSettingsDialog onClose={vi.fn()} /></UnitCatalogProvider></NotificationProvider>);
// jsdom exposes both responsive entry points; they open the same manager.
const manage = async () => fireEvent.click((await screen.findAllByRole('button', { name: 'Manage categories', exact: true }))[0]);
const newCategory = (name) => {
  fireEvent.change(screen.getByLabelText('New category name'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Add category', exact: true }));
};

beforeEach(() => {
  vi.clearAllMocks();
  settingsService.getSettingsGroup.mockResolvedValue({});
  settingsService.getUnitUsage.mockResolvedValue({});
  settingsService.updateSingleSetting.mockResolvedValue({});
  settingsService.updateSettingsBulk.mockResolvedValue({});
});

describe('managed unit categories', () => {
  it('creates an empty category and saves it independently of its first unit', async () => {
    mount();
    await manage();
    newCategory('  Temperature  ');
    await screen.findByText('Category created. You can now add units to it.');
    expect(settingsService.updateSettingsBulk).toHaveBeenCalledWith(expect.arrayContaining([
      { key: 'unitCategories', group: 'catalog', value: expect.arrayContaining(['Temperature']) },
    ]));
    expect(state().categories).toContain('Temperature');
    expect(state().units.some((unit) => unit.category === 'Temperature')).toBe(false);
  });

  it.each(['length', 'All units'])('rejects duplicate or reserved category names: %s', async (name) => {
    mount();
    await manage();
    newCategory(name);
    expect(screen.getByLabelText('New category name')).toHaveAttribute('aria-invalid', 'true');
    expect(settingsService.updateSettingsBulk).not.toHaveBeenCalled();
  });

  it('renames a category and all its units, including hidden units, in one save', async () => {
    settingsService.getSettingsGroup.mockResolvedValue({ unitCatalog: [{ value: 'cm', label: 'Centimetre', category: 'Length', enabled: false }] });
    mount();
    await manage();
    fireEvent.click(screen.getByRole('button', { name: 'Rename category Length', exact: true }));
    fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'Dimensions' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save category name', exact: true }));
    await screen.findByText('Category renamed. Its units have been updated.');
    expect(state().categories).toContain('Dimensions');
    expect(state().categories).not.toContain('Length');
    expect(state().units.find((unit) => unit.value === 'cm')).toMatchObject({ category: 'Dimensions', enabled: false });
    expect(state().units.some((unit) => unit.category === 'Length')).toBe(false);
    expect(settingsService.updateSettingsBulk.mock.calls[0][0]).toHaveLength(2);
    expect(settingsService.updateSingleSetting).not.toHaveBeenCalled();
  });

  it('offers deletion only for empty categories, without moving units', async () => {
    mount();
    await manage();
    expect(screen.queryByRole('button', { name: 'Delete category Length', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Move units to/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Only empty categories can be deleted/)).toBeInTheDocument();
    expect(settingsService.updateSettingsBulk).not.toHaveBeenCalled();
  });

  it('deletes an empty category without deleting any units', async () => {
    settingsService.getSettingsGroup.mockResolvedValue({ unitCategories: [...defaultCategories, 'Temperature'] });
    mount();
    await manage();
    const before = state().units;
    fireEvent.click(screen.getByRole('button', { name: 'Delete category Temperature', exact: true }));
    expect(screen.queryByRole('combobox', { name: /Move units to/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete category', exact: true }));
    const toast = await screen.findByRole('alert');
    expect(toast).toHaveTextContent('Category deleted.');
    expect(toast.closest('.MuiSnackbar-anchorOriginBottomCenter')).not.toBeNull();
    expect(within(screen.getByRole('dialog')).queryByRole('alert')).not.toBeInTheDocument();
    expect(state().categories).not.toContain('Temperature');
    expect(state().units).toEqual(before);
    expect(settingsService.updateSingleSetting).toHaveBeenCalledWith('unitCategories', expect.not.arrayContaining(['Temperature']), 'catalog');
    expect(settingsService.updateSettingsBulk).not.toHaveBeenCalled();
  });

  it('counts hidden units when deciding whether a category can be deleted', async () => {
    settingsService.getSettingsGroup.mockResolvedValue({ unitCategories: ['Only'], unitCatalog: STANDARD_UNITS.map((unit) => ({ ...unit, category: 'Only', enabled: false })) });
    mount();
    await manage();
    expect(screen.queryByRole('button', { name: 'Delete category Only', exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename category Only', exact: true })).toBeEnabled();
    expect(settingsService.updateSettingsBulk).not.toHaveBeenCalled();
  });

  it('preserves a unit draft while adding its missing category', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Add unit' }));
    fireEvent.change(screen.getByLabelText(/^Display name/), { target: { value: 'Seed tray' } });
    fireEvent.change(screen.getByLabelText(/^Symbol/), { target: { value: 'trays' } });
    await manage();
    newCategory('Nursery');
    await screen.findByText('Category created. You can now add units to it.');
    fireEvent.click(screen.getByRole('button', { name: 'Back to unit', exact: true }));
    expect(screen.getByLabelText(/^Display name/)).toHaveValue('Seed tray');
    expect(screen.getByLabelText(/^Symbol/)).toHaveValue('trays');
    fireEvent.change(screen.getByLabelText(/^Unit category/), { target: { value: 'Nursery' } });
    fireEvent.click(screen.getByRole('option', { name: 'Nursery', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Create unit' }));
    await screen.findByRole('table', { name: 'Unit catalog' });
    expect(state().units.find((unit) => unit.value === 'trays')).toMatchObject({ category: 'Nursery' });
  });

  it('keeps category data unchanged when the server rejects a save', async () => {
    settingsService.updateSettingsBulk.mockRejectedValueOnce(new Error('Save failed'));
    mount();
    await manage();
    newCategory('Temperature');
    const toast = await screen.findByRole('alert');
    expect(toast).toHaveTextContent('Save failed');
    expect(toast).toHaveClass('MuiAlert-filledError');
    expect(within(screen.getByRole('dialog')).queryByRole('alert')).not.toBeInTheDocument();
    expect(state().categories).not.toContain('Temperature');
    expect(screen.getByLabelText('New category name')).toHaveValue('Temperature');
  });

  it('retains an empty category if deletion fails and shows the error in a toast', async () => {
    settingsService.getSettingsGroup.mockResolvedValue({ unitCategories: [...defaultCategories, 'Temperature'] });
    settingsService.updateSingleSetting.mockRejectedValueOnce(new Error('Category now contains units.'));
    mount();
    await manage();
    fireEvent.click(screen.getByRole('button', { name: 'Delete category Temperature', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete category', exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Category now contains units.');
    expect(state().categories).toContain('Temperature');
    expect(screen.getByRole('button', { name: 'Delete category', exact: true })).toBeEnabled();
    expect(within(screen.getByRole('dialog')).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns before discarding an unsaved category draft', async () => {
    mount();
    await manage();
    fireEvent.change(screen.getByLabelText('New category name'), { target: { value: 'Unsaved' } });
    fireEvent.click(screen.getByText('Back to units', { selector: 'button' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Discard your unsaved changes?');
    fireEvent.click(screen.getByRole('button', { name: 'Discard', exact: true }));
    expect(screen.getByRole('table', { name: 'Unit catalog' })).toBeInTheDocument();
    expect(settingsService.updateSettingsBulk).not.toHaveBeenCalled();
  });

  it('requires selection from managed categories when creating a unit', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Add unit' }));
    fireEvent.change(screen.getByLabelText(/^Display name/), { target: { value: 'Custom' } });
    fireEvent.change(screen.getByLabelText(/^Symbol/), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText(/^Unit category/), { target: { value: 'Unregistered' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create unit' }));
    expect(screen.getByText(/Select a category from the list/)).toBeInTheDocument();
    expect(settingsService.updateSingleSetting).not.toHaveBeenCalled();
  });
});
