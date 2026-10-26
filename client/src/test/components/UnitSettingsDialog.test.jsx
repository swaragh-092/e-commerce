import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UnitSettingsDialog from '../../components/admin/UnitSettingsDialog';
import { UnitCatalogProvider, useUnitCatalog } from '../../context/UnitCatalogContext';
import settingsService from '../../services/settingsService';
import { NotificationProvider } from '../../context/NotificationContext';

vi.mock('../../services/settingsService', () => ({ default: { getSettingsGroup: vi.fn(), getUnitUsage: vi.fn(), updateSingleSetting: vi.fn(), updateSettingsBulk: vi.fn() } }));
const Probe = () => <output data-testid="catalog-state">{JSON.stringify(useUnitCatalog().units)}</output>;
const mount = () => {
  const onClose = vi.fn();
  render(<NotificationProvider><UnitCatalogProvider><Probe /><UnitSettingsDialog onClose={onClose} /></UnitCatalogProvider></NotificationProvider>);
  return onClose;
};
const openAdd = async (symbol = 'm³') => {
  fireEvent.click(await screen.findByRole('button', { name: 'Add unit' }));
  fireEvent.change(screen.getByLabelText(/^Display name/), { target: { value: 'Cubic metre' } });
  fireEvent.change(screen.getByLabelText(/^Symbol/), { target: { value: symbol } });
  fireEvent.change(screen.getByLabelText(/^Unit category/), { target: { value: 'Volume' } });
  fireEvent.click(screen.getByRole('option', { name: 'Volume', exact: true }));
};
const search = async (text) => fireEvent.change(await screen.findByLabelText('Search units'), { target: { value: text } });

beforeEach(() => {
  vi.clearAllMocks();
  settingsService.getSettingsGroup.mockResolvedValue({});
  settingsService.getUnitUsage.mockResolvedValue({});
  settingsService.updateSingleSetting.mockResolvedValue({});
  settingsService.updateSettingsBulk.mockResolvedValue({});
});

describe('unit settings management', () => {
  it('uses a focused editor and saves the unit in one step without closing the manager', async () => {
    const onClose = mount();
    await openAdd();
    expect(screen.getByText('10 m³')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Unit catalog' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create unit' }));
    await screen.findByRole('table', { name: 'Unit catalog' });
    expect(onClose).not.toHaveBeenCalled();
    expect(settingsService.updateSingleSetting).toHaveBeenCalledWith('unitCatalog', expect.arrayContaining([{ value: 'm³', label: 'Cubic metre', category: 'Volume', enabled: true }]), 'catalog');
    expect(screen.getByTestId('catalog-state')).toHaveTextContent('m³');
    const toast = screen.getByRole('alert');
    expect(toast).toHaveTextContent('Unit created.');
    expect(toast).toHaveClass('MuiAlert-filledSuccess');
    expect(toast.closest('.MuiSnackbar-anchorOriginBottomCenter')).not.toBeNull();
    expect(within(screen.getByRole('dialog')).queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows duplicate errors beside the symbol and keeps the editor available', async () => {
    mount();
    await openAdd('KG');
    fireEvent.click(screen.getByRole('button', { name: 'Create unit' }));
    expect(screen.getByLabelText(/^Symbol/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('This symbol already exists. Edit that unit instead.')).toBeInTheDocument();
    expect(settingsService.updateSingleSetting).not.toHaveBeenCalled();
  });

  it('preserves form data after save failure and lets the user retry', async () => {
    settingsService.updateSingleSetting.mockRejectedValueOnce(new Error('Connection failed'));
    mount();
    await openAdd();
    fireEvent.click(screen.getByRole('button', { name: 'Create unit' }));
    const toast = await screen.findByRole('alert');
    expect(toast).toHaveTextContent(/Connection failed|Could not save/);
    expect(toast).toHaveClass('MuiAlert-filledError');
    expect(toast.closest('.MuiSnackbar-anchorOriginBottomCenter')).not.toBeNull();
    expect(within(screen.getByRole('dialog')).queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Symbol/)).toHaveValue('m³');
    expect(screen.getByTestId('catalog-state')).not.toHaveTextContent('m³');
    fireEvent.click(screen.getByRole('button', { name: 'Create unit' }));
    await screen.findByRole('table', { name: 'Unit catalog' });
    expect(settingsService.updateSingleSetting).toHaveBeenCalledTimes(2);
  });

  it('keeps symbols fixed and saves visibility and name edits together', async () => {
    mount();
    await search('cm');
    fireEvent.click(screen.getByRole('button', { name: 'Edit cm', exact: true }));
    expect(screen.getByLabelText(/^Symbol/)).toHaveAttribute('readonly');
    fireEvent.change(screen.getByLabelText(/^Display name/), { target: { value: 'Centimetres' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Available for selection/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save unit' }));
    await screen.findByRole('table', { name: 'Unit catalog' });
    expect(settingsService.updateSingleSetting).toHaveBeenCalledWith('unitCatalog', expect.arrayContaining([expect.objectContaining({ value: 'cm', label: 'Centimetres', enabled: false })]), 'catalog');
  });

  it('blocks catalog edits after load failure and can reload safely', async () => {
    settingsService.getSettingsGroup.mockRejectedValueOnce(new Error('Unavailable'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable');
    expect(screen.getByRole('button', { name: 'Add unit' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry', exact: true }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add unit' })).toBeEnabled());
  });

  it('discards a canceled editor without any settings write', async () => {
    mount();
    await openAdd();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    expect(screen.getByRole('table', { name: 'Unit catalog' })).toBeInTheDocument();
    expect(settingsService.updateSingleSetting).not.toHaveBeenCalled();
  });

  it('warns before closing a modified form', async () => {
    const onClose = mount();
    await openAdd();
    fireEvent.click(screen.getByRole('button', { name: 'Close unit settings' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Discard your unsaved changes?');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText(/^Symbol/)).toHaveValue('m³');
  });

  it('disables deletion for used units while still allowing edits', async () => {
    settingsService.getUnitUsage.mockResolvedValue({ pc: { products: 2, attributes: 0, values: 0, total: 2 } });
    mount();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete pc', exact: true })).toBeDisabled());
    expect(await screen.findByText('In use (2)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit pc', exact: true })).toBeEnabled();
  });

  it('requires confirmation before deleting an unused built-in and keeps its removal marker', async () => {
    mount();
    await search('cm');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete cm', exact: true })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Delete cm', exact: true }));
    expect(screen.getByText('Delete Centimetre?')).toBeInTheDocument();
    expect(settingsService.updateSingleSetting).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete unit', exact: true }));
    await screen.findByRole('table', { name: 'Unit catalog' });
    expect(settingsService.updateSingleSetting).toHaveBeenCalledWith('unitCatalog', expect.arrayContaining([expect.objectContaining({ value: 'cm', enabled: false, deleted: true })]), 'catalog');
    const catalog = JSON.parse(screen.getByTestId('catalog-state').textContent);
    expect(catalog.some((unit) => unit.value === 'cm')).toBe(false);
  });

  it('retains earlier deletions when another unit is created', async () => {
    settingsService.getSettingsGroup.mockResolvedValue({ unitCatalog: [{ value: 'cm', label: 'Centimetre (cm)', category: 'Length', enabled: false, deleted: true }] });
    mount();
    await openAdd();
    fireEvent.click(screen.getByRole('button', { name: 'Create unit' }));
    await screen.findByRole('table', { name: 'Unit catalog' });
    expect(settingsService.updateSingleSetting).toHaveBeenCalledWith('unitCatalog', expect.arrayContaining([expect.objectContaining({ value: 'cm', deleted: true })]), 'catalog');
    expect(JSON.parse(screen.getByTestId('catalog-state').textContent).some((unit) => unit.value === 'cm')).toBe(false);
  });

  it('removes an unused custom definition without a built-in deletion marker', async () => {
    settingsService.getSettingsGroup.mockResolvedValue({ unitCatalog: [{ value: 'trays', label: 'Seed trays', category: 'Count / Packaging', enabled: true }] });
    mount();
    await search('trays');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete trays', exact: true })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Delete trays', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete unit', exact: true }));
    await screen.findByRole('table', { name: 'Unit catalog' });
    const saved = settingsService.updateSingleSetting.mock.calls[0][1];
    expect(saved.some((unit) => unit.value === 'trays')).toBe(false);
    expect(JSON.parse(screen.getByTestId('catalog-state').textContent).some((unit) => unit.value === 'trays')).toBe(false);
  });

  it('blocks deletion when usage cannot be checked and offers a retry', async () => {
    settingsService.getUnitUsage.mockRejectedValueOnce(new Error('Offline'));
    mount();
    expect(await screen.findByText('Usage is unavailable. Deletion is disabled.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete pc', exact: true })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry usage check' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete pc', exact: true })).toBeEnabled());
  });

  it('keeps the delete view open if the server finds a new reference', async () => {
    settingsService.updateSingleSetting.mockRejectedValueOnce(new Error('Cannot delete: unit is in use.'));
    mount();
    await search('cm');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete cm', exact: true })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Delete cm', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete unit', exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot delete');
    expect(screen.getByText('Delete Centimetre?')).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('catalog-state').textContent).some((unit) => unit.value === 'cm')).toBe(true);
  });
});
