import React from 'react';
import { Dialog } from '@mui/material';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BulkMediaCropDialog from '../../components/common/BulkMediaCropDialog';
import { mediaService } from '../../services/mediaService';
import * as edits from '../../utils/imageEditing';
vi.mock('../../services/mediaService', () => ({ mediaService: { uploadMedia: vi.fn(), replaceImage: vi.fn() } }));
vi.mock('../../utils/imageEditing', async (original) => ({ ...(await original()), loadImage: vi.fn(), editPreview: vi.fn(), exportEditedImage: vi.fn() }));
vi.mock('../../components/common/MediaImageEditor', () => ({ default: ({ initialSettings, onApplySettings }) => <Dialog open><button onClick={() => onApplySettings({ ...initialSettings, width: 600, rotation: 90 })}>Apply individual crop</button></Dialog> }));
const files = [1, 2].map(id => ({ id: String(id), originalName: `product-${id}.png`, url: `/product-${id}.png`, mimeType: 'image/png', type: 'image' }));
beforeEach(() => {
  vi.clearAllMocks();
  edits.loadImage.mockResolvedValue({ naturalWidth: 1800, naturalHeight: 1200 });
  edits.editPreview.mockImplementation((image, settings) => ({ preview: 'data:image/png;base64,preview', output: { width: settings.width, height: settings.width } }));
  edits.exportEditedImage.mockImplementation(async (_image, _angle, _crop, _width, name) => new File(['edited'], name, { type: 'image/webp' }));
  mediaService.uploadMedia.mockResolvedValue({ data: { media: { id: 'saved' } } });
});
afterEach(() => vi.restoreAllMocks());
const ready = () => waitFor(() => expect(screen.getByRole('button', { name: 'Save 2 images' })).toBeEnabled());
describe('bulk media crop review', () => {
  it('updates existing IDs when launched in replace mode', async () => {
    mediaService.replaceImage.mockResolvedValue({});
    render(<BulkMediaCropDialog replaceExisting files={files} onClose={vi.fn()} />);
    await ready();
    expect(screen.getByText(/Saving updates each image everywhere/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save 2 images' }));
    await waitFor(() => expect(mediaService.replaceImage).toHaveBeenCalledTimes(2));
    expect(mediaService.replaceImage.mock.calls.map(([id]) => id)).toEqual(['1', '2']);
    expect(mediaService.uploadMedia).not.toHaveBeenCalled();
  });
  it('shows a separate preview for every image before saving', async () => {
    render(<BulkMediaCropDialog files={files} onClose={vi.fn()} />);
    await ready();
    expect(screen.getByAltText('Crop preview for product-1.png')).toBeInTheDocument();
    expect(screen.getByAltText('Crop preview for product-2.png')).toBeInTheDocument();
    expect(mediaService.uploadMedia).not.toHaveBeenCalled();
  });
  it('applies a batch preset explicitly and keeps individual adjustments separate', async () => {
    render(<BulkMediaCropDialog files={files} onClose={vi.fn()} />);
    await ready();
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Mobile banner' }));
    expect(edits.editPreview).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Apply to all unfinished images' }));
    await waitFor(() => expect(edits.editPreview).toHaveBeenCalledTimes(4));
    expect(edits.editPreview.mock.calls[2][1].preset).toBe('mobile');
    fireEvent.click(screen.getByRole('button', { name: 'Adjust crop for product-1.png' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Apply individual crop' }));
    await waitFor(() => expect(edits.editPreview).toHaveBeenCalledTimes(5));
    expect(edits.editPreview.mock.calls[4][1]).toMatchObject({ width: 600, rotation: 90 });
    expect(edits.exportEditedImage).not.toHaveBeenCalled();
  });
  it('saves sequentially and retries failed images without duplicating successful saves', async () => {
    mediaService.uploadMedia.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({});
    const result = vi.fn();
    render(<BulkMediaCropDialog files={files} onClose={vi.fn()} onResults={result} />);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Save 2 images' }));
    await screen.findByText('Connection lost');
    expect(result).toHaveBeenCalledWith({ saved: 1, reused: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 image' }));
    await waitFor(() => expect(screen.getByText('2 of 2 saved or reused')).toBeInTheDocument());
    expect(mediaService.uploadMedia).toHaveBeenCalledTimes(3);
    expect(mediaService.uploadMedia.mock.calls[2][0].name).toBe('product-2.png');
  });
  it('supports duplicate reuse without a second upload', async () => {
    mediaService.uploadMedia.mockRejectedValueOnce({ response: { data: { error: { code: 'DUPLICATE_MEDIA', details: { media: { id: 'existing', originalName: 'existing.webp', size: 100 } } } } } });
    const result = vi.fn();
    render(<BulkMediaCropDialog files={[files[0]]} onClose={vi.fn()} onResults={result} />);
    const save = await screen.findByRole('button', { name: 'Save 1 image' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    fireEvent.click(await screen.findByRole('button', { name: 'Use existing image' }));
    await waitFor(() => expect(result).toHaveBeenCalledWith({ saved: 0, reused: 1 }));
    expect(mediaService.uploadMedia).toHaveBeenCalledOnce();
  });
  it('keeps GIFs unchanged and allows excluding an image', async () => {
    render(<BulkMediaCropDialog files={[...files, { id: 'gif', mimeType: 'image/gif', originalName: 'animation.gif' }]} onClose={vi.fn()} />);
    await ready();
    expect(screen.getByRole('checkbox', { name: 'Include animation.gif' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include product-2.png' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 image' }));
    await waitFor(() => expect(screen.getByText('1 of 3 saved or reused')).toBeInTheDocument());
    expect(mediaService.uploadMedia).toHaveBeenCalledOnce();
  });
  it('stops after the current image and leaves the rest ready to save', async () => {
    let finish;
    mediaService.uploadMedia.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<BulkMediaCropDialog files={files} onClose={vi.fn()} />);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Save 2 images' }));
    await waitFor(() => expect(mediaService.uploadMedia).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Stop after current image' }));
    await act(async () => finish({}));
    expect(screen.getByRole('button', { name: 'Save 1 image' })).toBeEnabled();
    expect(mediaService.uploadMedia).toHaveBeenCalledOnce();
  });
  it('shows failed source loads and allows preview retry', async () => {
    edits.loadImage.mockRejectedValueOnce(new Error('Source unavailable'));
    render(<BulkMediaCropDialog files={[files[0]]} onClose={vi.fn()} />);
    await screen.findByText('Source unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry preview' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save 1 image' })).toBeEnabled());
  });
});
