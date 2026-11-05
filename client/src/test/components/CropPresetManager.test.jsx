import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CropPresetManager from '../../components/common/CropPresetManager';
const custom = { id: 'custom:one', recordId: 'one', label: 'Portrait', width: 800, height: 1000, ratio: 0.8, custom: true };
let store;
beforeEach(() => { store = { custom: [custom], loading: false, error: '', reload: vi.fn(), create: vi.fn().mockResolvedValue(custom), update: vi.fn().mockResolvedValue(custom), remove: vi.fn().mockResolvedValue(custom), restore: vi.fn().mockResolvedValue(custom) }; });
const fill = () => {
  fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'Homepage hero' } });
  fireEvent.change(screen.getByLabelText('Preset width (px)'), { target: { value: '1920' } });
  fireEvent.change(screen.getByLabelText('Preset height (px)'), { target: { value: '640' } });
};
describe('custom preset management', () => {
  it('saves a named ratio and dimensions with numeric fields', async () => {
    render(<CropPresetManager store={store} onClose={vi.fn()} />);
    fill(); fireEvent.click(screen.getByRole('button', { name: 'Save preset' }));
    await waitFor(() => expect(store.create).toHaveBeenCalledWith({ name: 'Homepage hero', width: 1920, height: 640 }));
    expect(await screen.findByText('Preset “Homepage hero” saved.')).toBeInTheDocument();
  });
  it('prevents duplicate names and invalid dimensions before a request', () => {
    render(<CropPresetManager store={store} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: ' portrait ' } });
    expect(screen.getByRole('button', { name: 'Save preset' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'New preset' } });
    fireEvent.change(screen.getByLabelText('Preset width (px)'), { target: { value: '4097' } });
    expect(screen.getByRole('button', { name: 'Save preset' })).toBeDisabled();
    expect(store.create).not.toHaveBeenCalled();
  });
  it('edits an existing preset rather than creating another', async () => {
    render(<CropPresetManager store={store} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit preset Portrait' }));
    fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'Renamed portrait' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update preset' }));
    await waitFor(() => expect(store.update).toHaveBeenCalledWith('one', { name: 'Renamed portrait', width: 800, height: 1000 }));
    expect(store.create).not.toHaveBeenCalled();
  });
  it('offers undo after removing a preset', async () => {
    render(<CropPresetManager store={store} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove preset Portrait' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(store.restore).toHaveBeenCalledWith('one'));
  });
  it('keeps the form and shows a recoverable server error', async () => {
    store.create.mockRejectedValue({ response: { data: { error: { message: 'A preset with this name already exists.' } } } });
    render(<CropPresetManager store={store} onClose={vi.fn()} />);
    fill(); fireEvent.click(screen.getByRole('button', { name: 'Save preset' }));
    expect(await screen.findByText('A preset with this name already exists.')).toBeInTheDocument();
    expect(screen.getByLabelText('Preset name')).toHaveValue('Homepage hero');
  });
});
