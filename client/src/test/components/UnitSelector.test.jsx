import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UnitSelector from '../../components/admin/UnitSelector';
import { UnitCatalogProvider } from '../../context/UnitCatalogContext';
import settingsService from '../../services/settingsService';

vi.mock('../../services/settingsService', () => ({ default: { getSettingsGroup: vi.fn(), updateSingleSetting: vi.fn() } }));

const Harness = ({ initial = '', category }) => {
  const [value, setValue] = useState(initial);
  return <UnitCatalogProvider><UnitSelector label="Default unit" category={category} value={value} onChange={setValue} /><output data-testid="stored-unit">{value}</output></UnitCatalogProvider>;
};
const ready = async () => waitFor(() => expect(screen.getByRole('combobox', { name: 'Default unit category' })).not.toHaveAttribute('aria-disabled', 'true'));
const chooseCategory = (name) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Default unit category' }));
  fireEvent.click(screen.getByRole('option', { name, exact: true }));
};

beforeEach(() => {
  vi.clearAllMocks();
  settingsService.getSettingsGroup.mockResolvedValue({});
});

describe('category-first unit selection', () => {
  it('uses a fixed attribute category without showing another category selector', async () => {
    render(<Harness category="Length" />);
    const input = screen.getByRole('combobox', { name: 'Default unit', exact: true });
    await waitFor(() => expect(input).toBeEnabled());
    expect(screen.queryByRole('combobox', { name: 'Default unit category' })).not.toBeInTheDocument();
    fireEvent.mouseDown(input);
    expect(screen.getByRole('option', { name: 'Metre (m)', exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Millilitre (ml)' })).not.toBeInTheDocument();
  });

  it('preserves an old unit outside the category without offering it in the filtered list', async () => {
    render(<Harness category="Length" initial="ml" />);
    const input = screen.getByRole('combobox', { name: 'Default unit', exact: true });
    await waitFor(() => expect(input).toBeEnabled());
    expect(screen.getByTestId('stored-unit')).toHaveTextContent('ml');
    expect(screen.getByText(/Existing unit \(ml\) is preserved/)).toBeInTheDocument();
    fireEvent.mouseDown(input);
    expect(screen.queryByRole('option', { name: 'Millilitre (ml)' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Metre (m)', exact: true }));
    expect(screen.getByTestId('stored-unit')).toHaveTextContent('m');
  });

  it('requires a category and offers only that category’s units', async () => {
    render(<Harness />);
    await ready();
    expect(screen.getByRole('combobox', { name: 'Default unit', exact: true })).toBeDisabled();
    chooseCategory('Volume');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Default unit', exact: true }));
    expect(screen.getByRole('option', { name: 'Litre (L)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Centimetre (cm)' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Litre (L)' }));
    expect(screen.getByTestId('stored-unit')).toHaveTextContent('L');
    chooseCategory('Area');
    expect(screen.getByTestId('stored-unit')).toBeEmptyDOMElement();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Default unit', exact: true }));
    expect(screen.getByRole('option', { name: 'Square Metre (sq m)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Metre (m)', exact: true })).not.toBeInTheDocument();
  });

  it('infers existing categories and keeps legacy custom strings unchanged', async () => {
    render(<Harness initial="old-custom-unit" />);
    await ready();
    expect(screen.getByRole('combobox', { name: 'Default unit', exact: true })).toHaveValue('old-custom-unit');
    expect(screen.getByTestId('stored-unit')).toHaveTextContent('old-custom-unit');
    expect(screen.getByRole('combobox', { name: 'Default unit category' })).toHaveTextContent('Existing unit');
  });

  it('preserves a hidden selected unit while excluding it from new selections', async () => {
    settingsService.getSettingsGroup.mockResolvedValue({ unitCatalog: [{ value: 'cm', label: 'Centimetre (cm)', category: 'Length', enabled: false }] });
    render(<Harness initial="cm" />);
    await ready();
    expect(screen.getByTestId('stored-unit')).toHaveTextContent('cm');
    expect(screen.getByRole('combobox', { name: 'Default unit category' })).toHaveTextContent('Length');
    chooseCategory('No unit');
    chooseCategory('Length');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Default unit', exact: true }));
    expect(screen.queryByRole('option', { name: 'Centimetre (cm)' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Metre (m)', exact: true })).toBeInTheDocument();
  });

  it('loads persistent custom units and does not replace a saved unit while searching', async () => {
    settingsService.getSettingsGroup.mockResolvedValue({ unitCatalog: [{ value: 'm³', label: 'Cubic metre', category: 'Volume', enabled: true }] });
    render(<Harness initial="ml" />);
    await ready();
    const input = screen.getByRole('combobox', { name: 'Default unit', exact: true });
    fireEvent.change(input, { target: { value: 'Cubic' } });
    expect(screen.getByTestId('stored-unit')).toHaveTextContent('ml');
    fireEvent.click(await screen.findByRole('option', { name: 'Cubic metre' }));
    expect(screen.getByTestId('stored-unit')).toHaveTextContent('m³');
    expect(settingsService.getSettingsGroup).toHaveBeenCalledTimes(1);
  });
});
