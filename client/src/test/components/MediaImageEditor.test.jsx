import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MediaImageEditor from '../../components/common/MediaImageEditor';
import * as editing from '../../utils/imageEditing';
vi.mock('../../services/mediaService', () => ({ mediaService: { listCropPresets: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('../../utils/imageEditing', async (original) => ({ ...(await original()), loadImage: vi.fn(), drawCrop: vi.fn(), exportEditedImage: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback) { callback(new Blob(['preview'], { type: 'image/png' })); });
  editing.loadImage.mockResolvedValue({ naturalWidth: 1800, naturalHeight: 1200 });
  editing.exportEditedImage.mockResolvedValue(new File(['edited'], 'edited.webp', { type: 'image/webp' }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('image editor controls', () => {
  it('applies product and banner presets with proportional output', async () => {
    render(<MediaImageEditor source="/image.png" name="image.png" onSave={vi.fn()} onClose={vi.fn()} />);
    await screen.findByText('Output: 1800 × 1200 px');
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Product square' }));
    expect(screen.getByText('Output: 1200 × 1200 px')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Desktop banner' }));
    expect(screen.getByText('Output: 1800 × 600 px')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Output width (px)'), { target: { value: '900' } });
    expect(screen.getByText('Output: 900 × 300 px')).toBeInTheDocument();
  });
  it('rotates and resets, then passes the crop to export on save', async () => {
    const save = vi.fn();
    render(<MediaImageEditor source="/image.png" name="image.png" onSave={save} onClose={vi.fn()} />);
    await screen.findByText('Output: 1800 × 1200 px');
    fireEvent.click(screen.getByRole('button', { name: 'Rotate right' }));
    await screen.findByText('Output: 1200 × 1800 px');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await screen.findByText('Output: 1800 × 1200 px');
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: 'edited.webp' }), {}));
    expect(editing.exportEditedImage.mock.calls[0][1]).toBe(0);
  });
  it('prevents invalid resize values and shows save failures without closing', async () => {
    const close = vi.fn();
    render(<MediaImageEditor source="/image.png" name="image.png" onSave={() => Promise.reject(new Error('Network unavailable'))} onClose={close} />);
    await screen.findByText('Output: 1800 × 1200 px');
    fireEvent.change(screen.getByLabelText('Output width (px)'), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Output width (px)'), { target: { value: '600' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
    expect(await screen.findByText('Network unavailable')).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
});

describe('edited image duplicate choices', () => {
  it('offers reuse when saving an already uploaded edit', async () => {
    const existing = { id: 'existing-edit', originalName: 'saved-edit.webp', url: '/saved.webp', size: 1024 };
    const onSave = vi.fn().mockRejectedValue({ response: { data: { error: { code: 'DUPLICATE_MEDIA', details: { media: existing } } } } });
    const reuse = vi.fn();
    render(<MediaImageEditor source="/image.png" name="image.png" onSave={onSave} onReuseExisting={reuse} onClose={vi.fn()} />);
    await screen.findByText('Output: 1800 × 1200 px');
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use existing image' }));
    expect(reuse).toHaveBeenCalledWith(existing);
    expect(onSave).toHaveBeenCalledOnce();
  });
  it('retries the same exported file only after an explicit copy choice', async () => {
    const onSave = vi.fn().mockRejectedValueOnce({ response: { data: { error: { code: 'DUPLICATE_MEDIA', details: { media: { id: 'existing', size: 10 } } } } } }).mockResolvedValueOnce({});
    render(<MediaImageEditor source="/image.png" name="image.png" onSave={onSave} onReuseExisting={vi.fn()} onClose={vi.fn()} />);
    await screen.findByText('Output: 1800 × 1200 px');
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Upload another copy' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave.mock.calls[1][0]).toBe(onSave.mock.calls[0][0]);
    expect(onSave.mock.calls[1][1]).toEqual({ allowDuplicate: true });
  });
});
