import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AttributesPage from '../../../pages/admin/AttributesPage';
import { UnitCatalogProvider } from '../../../context/UnitCatalogContext';
import { NotificationProvider } from '../../../context/NotificationContext';
import attributeService from '../../../services/attributeService';
import settingsService from '../../../services/settingsService';

const permissions = vi.hoisted(() => ({ manage: true }));
vi.mock('../../../services/attributeService', () => ({ default: {
  getAttributes: vi.fn(), getAttributeById: vi.fn(), createAttribute: vi.fn(), updateAttribute: vi.fn(),
  removeAttributeValue: vi.fn(), reorderAttributeValues: vi.fn(),
  addAttributeValue: vi.fn(), updateAttributeValue: vi.fn(),
} }));
vi.mock('../../../services/settingsService', () => ({ default: { getSettingsGroup: vi.fn() } }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => permissions.manage }) }));
vi.mock('../../../hooks/useDebounce', () => ({ useDebounce: (value) => value }));

const height = { id: 'height', name: 'Height', slug: 'height', unitCategory: 'Length', values: [
  { id: 'short', value: '10', unitLabel: 'cm' }, { id: 'tall', value: '1 - 1.5', unitLabel: 'm' },
] };
const respond = (attribute = height) => {
  attributeService.getAttributes.mockResolvedValue({ data: { data: { rows: [attribute], count: 1 } } });
  attributeService.getAttributeById.mockResolvedValue({ data: { data: attribute } });
};
const mount = () => render(<NotificationProvider><UnitCatalogProvider><AttributesPage /></UnitCatalogProvider></NotificationProvider>);
const openValues = async () => fireEvent.click(await screen.findByRole('button', { name: '2 values' }));
const chooseUnit = (name, container = screen) => {
  fireEvent.mouseDown(container.getByRole('combobox', { name: 'Unit', exact: true }));
  fireEvent.click(screen.getByRole('option', { name, exact: true }));
};
const fillNewAttribute = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'New Attribute' }));
  const dialog = within(screen.getByRole('dialog'));
  fireEvent.change(dialog.getByLabelText('Name'), { target: { value: 'Plant height' } });
  await waitFor(() => expect(dialog.getByRole('combobox', { name: 'Unit category' })).not.toHaveAttribute('aria-disabled', 'true'));
  fireEvent.mouseDown(dialog.getByRole('combobox', { name: 'Unit category' }));
  fireEvent.click(screen.getByRole('option', { name: 'Length', exact: true }));
  return dialog;
};

beforeEach(() => {
  vi.clearAllMocks();
  permissions.manage = true;
  respond();
  settingsService.getSettingsGroup.mockResolvedValue({});
  attributeService.createAttribute.mockResolvedValue({ data: { data: { id: 'created-attribute', name: 'Plant height', unitCategory: 'Length' } } });
  attributeService.updateAttribute.mockResolvedValue({});
  attributeService.addAttributeValue.mockResolvedValue({});
  attributeService.updateAttributeValue.mockResolvedValue({});
  attributeService.removeAttributeValue.mockResolvedValue({});
});

describe('attribute category and value unit flow', () => {
  it('opens the values panel when an attribute row is clicked', async () => {
    mount();
    fireEvent.click(await screen.findByText('Height', { exact: true }));
    const popup = within(await screen.findByRole('dialog', { name: 'Values for Height' }));
    expect(popup.getByText('10cm')).toBeInTheDocument();
    expect(popup.getByText('1 - 1.5m')).toBeInTheDocument();
  });

  it.each(['Enter', ' '])('opens row values with %j without management permission', async (key) => {
    permissions.manage = false;
    mount();
    const row = await screen.findByRole('row', { name: 'View values for Height' });
    row.focus();
    fireEvent.keyDown(row, { key });
    const popup = within(await screen.findByRole('dialog', { name: 'Values for Height' }));
    expect(popup.getByText('10cm')).toBeInTheDocument();
    expect(popup.queryByRole('form')).not.toBeInTheDocument();
  });

  it('keeps edit and delete actions separate from opening row values', async () => {
    mount();
    const row = within(await screen.findByRole('row', { name: 'View values for Height' }));
    const editButton = row.getByRole('button', { name: 'Edit', exact: true });
    fireEvent.keyDown(editButton, { key: 'Enter' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(editButton);
    expect(await screen.findByRole('dialog', { name: 'Edit Attribute' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Values for Height' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(row.getByRole('button', { name: 'Delete', exact: true }));
    expect(await screen.findByRole('dialog', { name: 'Delete Attribute Template' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Values for Height' })).not.toBeInTheDocument();
  });

  it('previews value types and display styles without saving sample choices', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'New Attribute' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Color' } });
    expect(screen.getByText('Value type: color. Display style: swatch.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Color, Red' }));
    expect(screen.getByRole('button', { name: 'Color, Red, selected' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Display Style' }));
    fireEvent.click(screen.getByRole('option', { name: 'Dropdown', exact: true }));
    expect(screen.getByText('Value type: color. Display style: dropdown.')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Color', exact: true }));
    fireEvent.click(screen.getByRole('option', { name: 'Blue', exact: true }));
    expect(attributeService.createAttribute).not.toHaveBeenCalled();
    expect(attributeService.addAttributeValue).not.toHaveBeenCalled();
    expect(screen.getByText(/Example values only; these will not be saved/)).toBeInTheDocument();
  });
  it('creates a template with only a category, without choosing a default unit', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'New Attribute' }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Name'), { target: { value: 'Plant height' } });
    await waitFor(() => expect(dialog.getByRole('combobox', { name: 'Unit category' })).not.toHaveAttribute('aria-disabled', 'true'));
    fireEvent.mouseDown(dialog.getByRole('combobox', { name: 'Unit category' }));
    fireEvent.click(screen.getByRole('option', { name: 'Length', exact: true }));
    expect(dialog.queryByRole('combobox', { name: 'Unit', exact: true })).not.toBeInTheDocument();
    expect(dialog.queryByRole('combobox', { name: /Default unit/ })).not.toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Create', exact: true }));
    await waitFor(() => expect(attributeService.createAttribute).toHaveBeenCalledWith({ name: 'Plant height', displayType: 'auto', valueType: 'auto', unitCategory: 'Length' }));
    const valuesDialog = await screen.findByRole('dialog', { name: 'Values for Plant height' });
    expect(within(valuesDialog).getByPlaceholderText('New value…')).toHaveFocus();
    expect(within(valuesDialog).getByText('No values yet')).toBeInTheDocument();
    expect(within(valuesDialog).queryByRole('combobox', { name: 'Unit category' })).not.toBeInTheDocument();
  });

  it('offers only the template category’s units and saves different units on individual values', async () => {
    mount();
    await openValues();
    expect(screen.queryByRole('combobox', { name: 'Unit category' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('New value…'), { target: { value: '600 - 900' } });
    expect(screen.getByRole('button', { name: 'Add value', exact: true })).toBeDisabled();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Unit', exact: true }));
    expect(screen.getByRole('option', { name: 'Centimetre (cm)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Metre (m)', exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Millilitre (ml)' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Centimetre (cm)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add value', exact: true }));
    await waitFor(() => expect(attributeService.addAttributeValue).toHaveBeenCalledWith('height', expect.objectContaining({ value: '600 - 900', unitLabel: 'cm' })));
    const valueInput = await screen.findByPlaceholderText('New value…');
    await waitFor(() => expect(valueInput).toBeEnabled());
    fireEvent.change(valueInput, { target: { value: '1 - 1.5' } });
    chooseUnit('Metre (m)');
    fireEvent.click(screen.getByRole('button', { name: 'Add value', exact: true }));
    await waitFor(() => expect(attributeService.addAttributeValue).toHaveBeenLastCalledWith('height', expect.objectContaining({ value: '1 - 1.5', unitLabel: 'm' })));
  });

  it('uses the same category restriction when editing a value', async () => {
    mount();
    await openValues();
    fireEvent.click(screen.getByRole('button', { name: 'Edit 10cm', exact: true }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.queryByRole('combobox', { name: 'Unit category' })).not.toBeInTheDocument();
    chooseUnit('Metre (m)', dialog);
    fireEvent.click(dialog.getByRole('button', { name: 'Save value' }));
    await waitFor(() => expect(attributeService.updateAttributeValue).toHaveBeenCalledWith('height', 'short', expect.objectContaining({ value: '10', unitLabel: 'm' })));
  });

  it('keeps non-measurement attributes free of unit controls', async () => {
    respond({ id: 'firmness', name: 'Firmness', slug: 'firmness', values: [] });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: '0 values' }));
    expect(screen.queryByRole('combobox', { name: 'Unit', exact: true })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('New value…'), { target: { value: 'Firm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add value', exact: true }));
    await waitFor(() => expect(attributeService.addAttributeValue).toHaveBeenCalledWith('firmness', expect.objectContaining({ value: 'Firm', unitLabel: null })));
  });

  it('infers legacy categories and preserves the existing default when editing a value', async () => {
    respond({ ...height, unitCategory: null, unit: 'cm', values: [{ id: 'short', value: '10' }, { id: 'tall', value: '20' }] });
    mount();
    await openValues();
    fireEvent.click(screen.getByRole('button', { name: 'Edit 10cm', exact: true }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('combobox', { name: 'Unit', exact: true })).toHaveValue('Centimetre (cm)');
    fireEvent.change(dialog.getByLabelText(/^Value/), { target: { value: '11' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save value' }));
    await waitFor(() => expect(attributeService.updateAttributeValue).toHaveBeenCalledWith('height', 'short', expect.objectContaining({ value: '11', unitLabel: 'cm' })));
  });

  it('preserves a value draft after the server rejects its unit', async () => {
    attributeService.addAttributeValue.mockRejectedValueOnce(new Error('Unit is no longer available.'));
    mount();
    await openValues();
    fireEvent.change(screen.getByPlaceholderText('New value…'), { target: { value: '10 - 20' } });
    chooseUnit('Centimetre (cm)');
    fireEvent.click(screen.getByRole('button', { name: 'Add value', exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unit is no longer available.');
    expect(screen.getByPlaceholderText('New value…')).toHaveValue('10 - 20');
    expect(screen.getByRole('combobox', { name: 'Unit', exact: true })).toHaveValue('Centimetre (cm)');
  });

  it('opens the newly created attribute’s popup even when the list does not contain it', async () => {
    attributeService.getAttributes.mockResolvedValue({ data: { data: { rows: [], count: 0 } } });
    attributeService.getAttributeById.mockResolvedValue({ data: { data: { id: 'created-attribute', name: 'Plant height', unitCategory: 'Length', values: [{ id: 'first', value: '20', unitLabel: 'cm' }] } } });
    mount();
    const create = await fillNewAttribute();
    fireEvent.click(create.getByRole('button', { name: 'Create', exact: true }));
    const popup = within(await screen.findByRole('dialog', { name: 'Values for Plant height' }));
    fireEvent.change(popup.getByLabelText(/^Value/), { target: { value: '20' } });
    chooseUnit('Centimetre (cm)', popup);
    fireEvent.click(popup.getByRole('button', { name: 'Add value', exact: true }));
    await waitFor(() => expect(attributeService.addAttributeValue).toHaveBeenCalledWith('created-attribute', expect.objectContaining({ value: '20', unitLabel: 'cm' })));
    expect(await popup.findByText('20cm')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Values for Plant height' })).toBeInTheDocument();
  });

  it('keeps the creation form open if creating an attribute fails', async () => {
    attributeService.createAttribute.mockRejectedValueOnce(new Error('Attribute could not be created.'));
    mount();
    const create = await fillNewAttribute();
    fireEvent.click(create.getByRole('button', { name: 'Create', exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Attribute could not be created.');
    expect(screen.queryByRole('dialog', { name: /^Values for/ })).not.toBeInTheDocument();
    expect(create.getByLabelText('Name')).toHaveValue('Plant height');
    expect(create.getByRole('button', { name: 'Create', exact: true })).toBeEnabled();
  });

  it('protects an unsaved value when closing the popup', async () => {
    mount();
    await openValues();
    fireEvent.change(screen.getByPlaceholderText('New value…'), { target: { value: 'Unsaved range' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done', exact: true }));
    const confirmation = within(await screen.findByRole('dialog', { name: 'Discard unsaved value?' }));
    fireEvent.click(confirmation.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByPlaceholderText('New value…')).toHaveValue('Unsaved range');
    fireEvent.click(await screen.findByRole('button', { name: 'Done', exact: true }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Discard unsaved value?' })).getByRole('button', { name: 'Discard value', exact: true }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Values for Height' })).not.toBeInTheDocument());
    expect(attributeService.addAttributeValue).not.toHaveBeenCalled();
  });

  it('refreshes saved values without closing the popup or losing its attribute', async () => {
    attributeService.getAttributeById.mockResolvedValue({ data: { data: { ...height, values: [...height.values, { id: 'new', value: '30', unitLabel: 'cm' }] } } });
    mount();
    await openValues();
    const popup = within(screen.getByRole('dialog', { name: 'Values for Height' }));
    fireEvent.change(popup.getByPlaceholderText('New value…'), { target: { value: '30' } });
    chooseUnit('Centimetre (cm)', popup);
    fireEvent.click(popup.getByRole('button', { name: 'Add value', exact: true }));
    expect(await popup.findByText('30cm')).toBeInTheDocument();
    expect(popup.getAllByRole('listitem')).toHaveLength(3);
    expect(popup.getByPlaceholderText('New value…')).toHaveValue('');
    await waitFor(() => expect(popup.getByPlaceholderText('New value…')).toHaveFocus());
  });

  it('prevents duplicate additions when saving succeeded but refreshing failed', async () => {
    attributeService.getAttributeById.mockRejectedValueOnce(new Error('Refresh unavailable.'));
    mount();
    await openValues();
    fireEvent.change(screen.getByPlaceholderText('New value…'), { target: { value: '30' } });
    chooseUnit('Centimetre (cm)');
    fireEvent.click(screen.getByRole('button', { name: 'Add value', exact: true }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Refresh unavailable.'));
    expect(screen.getByText(/Your change was saved/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('New value…')).toHaveValue('');
    expect(screen.getByPlaceholderText('New value…')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh values', exact: true }));
    await waitFor(() => expect(screen.getByPlaceholderText('New value…')).toBeEnabled());
    expect(attributeService.addAttributeValue).toHaveBeenCalledTimes(1);
  });

  it('retains a value if the server rejects its deletion because it is in use', async () => {
    attributeService.removeAttributeValue.mockRejectedValueOnce(new Error('This value is used by products.'));
    mount();
    await openValues();
    fireEvent.click(screen.getByRole('button', { name: 'Delete 10cm', exact: true }));
    const confirmation = within(await screen.findByRole('dialog', { name: 'Delete value?' }));
    fireEvent.click(confirmation.getByRole('button', { name: 'Delete value', exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This value is used by products.');
    expect(screen.getByText('10cm')).toBeInTheDocument();
    expect(attributeService.getAttributeById).not.toHaveBeenCalled();
  });

  it('allows viewing values without management permission', async () => {
    permissions.manage = false;
    mount();
    await openValues();
    const popup = within(screen.getByRole('dialog', { name: 'Values for Height' }));
    expect(popup.getByText('10cm')).toBeInTheDocument();
    expect(popup.queryByRole('form')).not.toBeInTheDocument();
    expect(popup.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument();
    expect(popup.queryByRole('button', { name: /^Delete / })).not.toBeInTheDocument();
  });
});
