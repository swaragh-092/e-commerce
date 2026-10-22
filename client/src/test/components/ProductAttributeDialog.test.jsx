import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductAttributeDialog from '../../components/admin/ProductAttributeDialog';
import { NotificationProvider } from '../../context/NotificationContext';
import { UnitCatalogProvider } from '../../context/UnitCatalogContext';
import attributeService from '../../services/attributeService';
import settingsService from '../../services/settingsService';

vi.mock('../../services/attributeService', () => ({ default: { getAttributes: vi.fn(), getAttributeById: vi.fn(), assignProductAttribute: vi.fn(), createAttribute: vi.fn(), addAttributeValue: vi.fn() } }));
vi.mock('../../services/settingsService', () => ({ default: { getSettingsGroup: vi.fn() } }));
const height = { id: 'height', name: 'Height', unitCategory: 'Length', values: [{ id: 'ten', value: '10', unitLabel: 'cm', imageUrl: '/height-example.png' }, { id: 'twenty', value: '20', unitLabel: 'cm' }] };
const color = { id: 'color', name: 'Color', valueType: 'color', values: [] };
const onSaved = vi.fn();
const onClose = vi.fn();
const mount = (props = {}) => render(<NotificationProvider><UnitCatalogProvider><ProductAttributeDialog productId="product" templates={[height, color]} rows={[]} onSaved={onSaved} onClose={onClose} {...props} /></UnitCatalogProvider></NotificationProvider>);
const choose = async (name) => {
  fireEvent.change(screen.getByRole('combobox', { name: 'Attribute', exact: true }), { target: { value: name } });
  fireEvent.click(await screen.findByRole('option', { name, exact: true }));
  await waitFor(() => expect(screen.queryByLabelText('Loading attribute values')).not.toBeInTheDocument());
};
const create = async (name = 'Diameter') => {
  fireEvent.change(screen.getByRole('combobox', { name: 'Attribute', exact: true }), { target: { value: name } });
  fireEvent.click(await screen.findByRole('option', { name: `Create “${name}”`, exact: true }));
};
const lengthCategory = async () => {
  const select = screen.getByRole('combobox', { name: 'Unit category', exact: true });
  await waitFor(() => expect(select).not.toHaveAttribute('aria-disabled', 'true'));
  fireEvent.mouseDown(select); fireEvent.click(screen.getByRole('option', { name: 'Length', exact: true }));
};
const enterRange = (value = '1 - 1.5') => {
  fireEvent.change(screen.getByLabelText('New value'), { target: { value } });
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Unit', exact: true }));
  expect(screen.queryByRole('option', { name: 'Millilitre (ml)' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('option', { name: 'Metre (m)', exact: true }));
};

beforeEach(() => {
  vi.clearAllMocks();
  settingsService.getSettingsGroup.mockResolvedValue({});
  attributeService.getAttributes.mockResolvedValue({ data: { data: { rows: [height, color] } } });
  attributeService.getAttributeById.mockImplementation(async (id) => ({ data: { data: id === 'height' ? height : color } }));
  attributeService.assignProductAttribute.mockResolvedValue({ data: { data: [] } });
});

describe('unified product attribute picker', () => {
  it('selects existing values without separate new/existing tabs', async () => {
    mount(); await choose('Height');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByAltText('')).toHaveAttribute('src', '/height-example.png');
    fireEvent.click(screen.getByRole('checkbox', { name: '10cm', exact: true }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Use these values to create variants' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to product' }));
    await waitFor(() => expect(attributeService.assignProductAttribute).toHaveBeenCalledWith('product', { attributeId: 'height', values: [{ valueId: 'ten' }], isVariantAttr: true }));
    expect(onSaved).toHaveBeenCalled();
  });
  it('creates an attribute and its first value only when saving to the product', async () => {
    mount(); await create(); await lengthCategory(); enterRange();
    expect(attributeService.createAttribute).not.toHaveBeenCalled();
    expect(attributeService.addAttributeValue).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Add to product' }));
    await waitFor(() => expect(attributeService.assignProductAttribute).toHaveBeenCalledWith('product', {
      attribute: { name: 'Diameter', unitCategory: 'Length', valueType: 'auto' },
      values: [{ value: '1 - 1.5', unitLabel: 'm', swatchColor: null }], isVariantAttr: false,
    }));
  });
  it('adds an existing choice and a newly entered choice in the same save', async () => {
    mount(); await choose('Height');
    fireEvent.click(screen.getByRole('checkbox', { name: '10cm', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a value', exact: true })); enterRange();
    fireEvent.click(screen.getByRole('button', { name: 'Add to product' }));
    await waitFor(() => expect(attributeService.assignProductAttribute).toHaveBeenCalledWith('product', expect.objectContaining({ values: [{ valueId: 'ten' }, { value: '1 - 1.5', unitLabel: 'm', swatchColor: null }] })));
  });
  it('marks already assigned values and prevents duplicate selection', async () => {
    mount({ rows: [{ attributeId: 'height', valueId: 'ten' }] }); await choose('Height');
    expect(screen.getByRole('checkbox', { name: /10cm.*Already on product/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add to product' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: '20cm', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to product' }));
    await waitFor(() => expect(attributeService.assignProductAttribute).toHaveBeenCalledWith('product', expect.objectContaining({ values: [{ valueId: 'twenty' }] })));
  });
  it('preserves the entire draft on failure and allows a safe retry', async () => {
    attributeService.assignProductAttribute.mockRejectedValueOnce(new Error('Assignment failed.'));
    mount(); await create(); await lengthCategory(); enterRange();
    fireEvent.click(screen.getByRole('button', { name: 'Add to product' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Assignment failed.');
    expect(screen.getByLabelText('New value')).toHaveValue('1 - 1.5');
    expect(screen.getByRole('combobox', { name: 'Unit', exact: true })).toHaveValue('Metre (m)');
    fireEvent.click(screen.getByRole('button', { name: 'Add to product' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(attributeService.assignProductAttribute.mock.calls[0]).toEqual(attributeService.assignProductAttribute.mock.calls[1]);
  });
  it('does not create abandoned templates or values when cancelling', async () => {
    mount(); await create();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Discard attribute changes?' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(attributeService.assignProductAttribute).not.toHaveBeenCalled();
    expect(attributeService.createAttribute).not.toHaveBeenCalled();
  });
  it('protects selected values when changing to another attribute', async () => {
    mount(); await choose('Height');
    fireEvent.click(screen.getByRole('checkbox', { name: '10cm', exact: true }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Attribute', exact: true }), { target: { value: 'Color' } });
    fireEvent.click(screen.getByRole('option', { name: 'Color', exact: true }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Change attribute?' })).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Attribute', exact: true })).toHaveValue('Height'));
    expect(screen.getByRole('checkbox', { name: '10cm', exact: true })).toBeChecked();
  });
  it('requires a matching unit before adding a measured value', async () => {
    mount(); await create(); await lengthCategory();
    fireEvent.change(screen.getByLabelText('New value'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to product' }));
    expect(screen.getByText('Choose a Length unit.')).toBeInTheDocument();
    expect(attributeService.assignProductAttribute).not.toHaveBeenCalled();
  });
  it('blocks saving stale values until loading can be retried', async () => {
    attributeService.getAttributeById.mockRejectedValueOnce(new Error('Values unavailable.'));
    mount(); await choose('Height');
    await screen.findByRole('alert');
    expect(screen.getByRole('checkbox', { name: '10cm', exact: true })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading attributes' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: '10cm', exact: true })).toBeEnabled());
  });
});
