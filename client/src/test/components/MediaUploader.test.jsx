import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MediaUploader from '../../components/common/MediaUploader';
import { mediaService } from '../../services/mediaService';
const notify = vi.hoisted(() => vi.fn());
vi.mock('../../context/NotificationContext', () => ({ useNotification: () => ({ notify }) }));
vi.mock('../../services/mediaService', () => ({ mediaService: { uploadMedia: vi.fn() } }));
vi.mock('../../components/common/MediaImageEditor', () => ({ default: ({ onSave }) => <button onClick={() => onSave(new File(['edited'], 'edited.webp', { type: 'image/webp' }))}>Apply test crop</button> }));
const media = { id: 'existing', originalName: 'original.png', url: '/uploads/existing.png', size: 1024 };
const duplicateError = { response: { data: { error: { code: 'DUPLICATE_MEDIA', details: { media } } } } };
const image = (name = 'new.png') => new File(['image'], name, { type: 'image/png' });
const choose = (files) => fireEvent.change(screen.getByLabelText('Choose images'), { target: { files } });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }));
  mediaService.uploadMedia.mockResolvedValue({ success: true, data: { media: { id: 'new' } } });
});
afterEach(() => vi.unstubAllGlobals());

describe('media upload review and duplicates', () => {
  it('allows crop review before a manual upload and uploads the edited file', async () => {
    render(<MediaUploader autoUpload={false} />);
    choose([image()]);
    expect(mediaService.uploadMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit new.png' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Apply test crop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload 1 image' }));
    await waitFor(() => expect(mediaService.uploadMedia).toHaveBeenCalledWith(expect.objectContaining({ name: 'edited.webp' }), 'image', expect.any(AbortSignal)));
  });
  it('reuses the existing media without uploading a second copy', async () => {
    mediaService.uploadMedia.mockRejectedValueOnce(duplicateError);
    const onUploadSuccess = vi.fn();
    const complete = vi.fn();
    render(<MediaUploader onUploadSuccess={onUploadSuccess} onAllUploadsComplete={complete} />);
    choose([image('renamed.png')]);
    await screen.findByRole('dialog');
    expect(screen.getByText('original.png')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use existing image' }));
    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalledWith(media));
    expect(mediaService.uploadMedia).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledOnce();
  });
  it('only overrides detection after the admin chooses another copy', async () => {
    mediaService.uploadMedia.mockRejectedValueOnce(duplicateError);
    render(<MediaUploader />);
    choose([image()]);
    fireEvent.click(await screen.findByRole('button', { name: 'Upload another copy' }));
    await waitFor(() => expect(mediaService.uploadMedia).toHaveBeenCalledTimes(2));
    expect(mediaService.uploadMedia.mock.calls[1][3]).toEqual({ allowDuplicate: true });
  });
  it('skips a duplicate and continues the rest of a batch before completion', async () => {
    mediaService.uploadMedia.mockRejectedValueOnce(duplicateError);
    const success = vi.fn();
    const complete = vi.fn();
    render(<MediaUploader onUploadSuccess={success} onAllUploadsComplete={complete} />);
    choose([image('one.png'), image('two.png')]);
    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(complete).toHaveBeenCalledOnce());
    expect(success).toHaveBeenCalledTimes(1);
    expect(mediaService.uploadMedia).toHaveBeenCalledTimes(2);
  });
  it('retains a failed row for retry and does not close the upload flow', async () => {
    mediaService.uploadMedia.mockRejectedValueOnce(new Error('Connection lost'));
    const complete = vi.fn();
    render(<MediaUploader onAllUploadsComplete={complete} />);
    choose([image()]);
    await screen.findByText('Connection lost');
    expect(complete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Upload 1 image' }));
    await waitFor(() => expect(complete).toHaveBeenCalledOnce());
  });
  it('cancels a pending duplicate choice and leaves the image ready to retry', async () => {
    mediaService.uploadMedia.mockRejectedValueOnce(duplicateError);
    const success = vi.fn();
    render(<MediaUploader onUploadSuccess={success} />);
    choose([image()]);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel upload' }));
    await screen.findByRole('button', { name: 'Upload 1 image' });
    expect(success).not.toHaveBeenCalled();
  });
  it('validates file type before any network request and rejects extra files in single mode', async () => {
    render(<MediaUploader multiple={false} />);
    fireEvent.change(screen.getByLabelText('Choose images'), { target: { files: [new File(['bad'], 'bad.svg', { type: 'image/svg+xml' }), image()] } });
    expect(await screen.findByText('Choose a JPEG, PNG, WebP, or GIF image.')).toBeInTheDocument();
    expect(mediaService.uploadMedia).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('Only one image can be selected here.', 'info');
  });
  it('aborts an active request on unmount without calling completion', async () => {
    let finish;
    mediaService.uploadMedia.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const complete = vi.fn();
    const result = render(<MediaUploader onAllUploadsComplete={complete} />);
    choose([image()]);
    const signal = mediaService.uploadMedia.mock.calls[0][2];
    result.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => finish({ data: { media } }));
    expect(complete).not.toHaveBeenCalled();
  });
});
