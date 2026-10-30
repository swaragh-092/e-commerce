import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MediaPage from '../../../pages/admin/MediaPage';
import { mediaService } from '../../../services/mediaService';

const access = vi.hoisted(() => ({ canDelete: true }));
const { notify, confirm } = vi.hoisted(() => ({
  notify: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: (permission) => permission !== 'media.delete' || access.canDelete }) }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify, confirm }) }));
vi.mock('../../../services/mediaService', () => ({
  mediaService: {
    list: vi.fn(),
    listIcons: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    uploadMedia: vi.fn(),
    uploadIcon: vi.fn(),
  },
}));

describe('Media Library tabs', () => {
  let observers;

  beforeEach(() => {
    vi.clearAllMocks();
    access.canDelete = true;
    confirm.mockResolvedValue(true);
    mediaService.delete.mockResolvedValue({});
    observers = [];
    mediaService.listIcons.mockResolvedValue({ data: [] });
    mediaService.list.mockImplementation(({ page }) => Promise.resolve({
      data: [{ id: `media-${page}`, url: `/media-${page}.png`, originalName: `media-${page}.png`, size: 1024, usageCount: 2 }],
      meta: { totalItems: 2, page, totalPages: 2 },
    }));

    class MockIntersectionObserver {
      constructor(callback) {
        this.callback = callback;
        this.observe = vi.fn();
        this.unobserve = vi.fn();
        this.disconnect = vi.fn();
        observers.push(this);
      }
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('reattaches infinite scroll to the media sentinel after switching tabs', async () => {
    render(<MediaPage />);

    const firstLoadMore = await screen.findByRole('button', { name: 'Scroll for more' });
    const firstSentinel = firstLoadMore.parentElement;
    await waitFor(() => expect(observers).toHaveLength(1));
    expect(observers[0].observe).toHaveBeenCalledWith(firstSentinel);

    fireEvent.click(screen.getByRole('tab', { name: 'Icon library' }));
    await waitFor(() => expect(observers[0].disconnect).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('tab', { name: 'Media files' }));
    const restoredSentinel = (await screen.findByRole('button', { name: 'Scroll for more' })).parentElement;

    await waitFor(() => expect(observers).toHaveLength(2));
    expect(restoredSentinel).toBe(firstSentinel);
    expect(observers[1].observe).toHaveBeenCalledWith(restoredSentinel);

    await act(async () => observers[1].callback([{ isIntersecting: true }]));
    await waitFor(() => expect(mediaService.list).toHaveBeenCalledTimes(2));
    expect(mediaService.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('finds icons by the prefixed IDs shown on their cards', async () => {
    render(<MediaPage />);

    fireEvent.click(screen.getByRole('tab', { name: 'Icon library' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search icon library' }), {
      target: { value: 'mui:eco' },
    });

    expect(await screen.findByText('mui:eco')).toBeInTheDocument();
    expect(screen.getByText('1 icon')).toBeInTheDocument();
  });

  it('shows per-image usage and requests the unused filter from the server', async () => {
    render(<MediaPage />);

    expect(await screen.findByText('Used 2 times')).toBeInTheDocument();
    expect(mediaService.list).toHaveBeenCalledWith(expect.objectContaining({ usage: 'all' }));

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Usage' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Unused images' }));

    await waitFor(() => expect(mediaService.list).toHaveBeenLastCalledWith(expect.objectContaining({ usage: 'unused' })));
  });

  it('copies a media image URL with the current site origin', async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const originalSecureContext = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });

    try {
      render(<MediaPage />);
      fireEvent.click(await screen.findByRole('button', { name: 'Copy URL' }));

      await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/media-1.png`));
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else delete navigator.clipboard;
      if (originalSecureContext) Object.defineProperty(window, 'isSecureContext', originalSecureContext);
      else delete window.isSecureContext;
    }
  });

  it('renders custom icons and displays upload button in icon library', async () => {
    mediaService.listIcons.mockResolvedValue({
      data: [{ id: 'custom-icon-1', url: '/uploads/custom-brand.png', originalName: 'custom-brand.png' }],
    });

    render(<MediaPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Icon library' }));

    expect(await screen.findByText('Upload Custom Icon')).toBeInTheDocument();
    expect(await screen.findByText('custom-brand.png')).toBeInTheDocument();
  });
  it('selects multiple images and confirms their deletion once with an in-use warning', async () => {
    let remaining = [
      { id: 'a', originalName: 'a.jpg', url: '/a.jpg', usageCount: 1 },
      { id: 'b', originalName: 'b.jpg', url: '/b.jpg', usageCount: 0 },
    ];
    mediaService.list.mockImplementation(async () => ({ data: remaining, meta: { totalItems: remaining.length, page: 1, totalPages: 1 } }));
    mediaService.delete.mockImplementation(async (id) => { remaining = remaining.filter((file) => file.id !== id); });
    render(<MediaPage />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select a.jpg' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select b.jpg' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected (2)' }));
    await waitFor(() => expect(mediaService.delete).toHaveBeenCalledTimes(2));
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith('Delete selected images', expect.stringContaining('1 selected image is in use'), 'danger');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete selected (0)' })).toBeDisabled());
    expect(notify).toHaveBeenCalledWith('Deleted 2 images.', 'success');
  });
  it('keeps selection and makes no delete requests when confirmation is cancelled', async () => {
    confirm.mockResolvedValue(false);
    render(<MediaPage />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select media-1.png' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected (1)' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
    expect(mediaService.delete).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Select media-1.png' })).toBeChecked();
  });
  it('selects only loaded images and clears selection when changing the usage filter', async () => {
    render(<MediaPage />);
    await screen.findByRole('checkbox', { name: 'Select media-1.png' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all loaded images' }));
    expect(screen.getByRole('button', { name: 'Delete selected (1)' })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('1 selected · 1 loaded of 2');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Usage' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Unused images' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete selected (0)' })).toBeDisabled());
    expect(mediaService.delete).not.toHaveBeenCalled();
  });
  it('keeps only failed deletions selected and supports retry', async () => {
    let remaining = [{ id: 'a', originalName: 'a.jpg', url: '/a.jpg' }, { id: 'b', originalName: 'b.jpg', url: '/b.jpg' }];
    let fail = true;
    mediaService.list.mockImplementation(async () => ({ data: remaining, meta: { totalItems: remaining.length, page: 1, totalPages: 1 } }));
    mediaService.delete.mockImplementation(async (id) => {
      if (id === 'b' && fail) throw new Error('Image is protected');
      remaining = remaining.filter((file) => file.id !== id);
    });
    render(<MediaPage />);
    await screen.findByRole('checkbox', { name: 'Select a.jpg' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all loaded images' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected (2)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('b.jpg: Image is protected');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete selected (1)' })).toBeEnabled());
    expect(screen.getByRole('checkbox', { name: 'Select b.jpg' })).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Select a.jpg' })).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected (1)' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete selected (0)' })).toBeDisabled());
    expect(mediaService.delete.mock.calls.map(([id]) => id)).toEqual(['a', 'b', 'b']);
  });
  it('hides selection and batch deletion without delete permission', async () => {
    access.canDelete = false;
    render(<MediaPage />);
    await screen.findByText('Used 2 times');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete selected/ })).not.toBeInTheDocument();
  });
  it('disables batch controls while deleting and avoids duplicate submissions', async () => {
    let finish;
    mediaService.delete.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<MediaPage />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select media-1.png' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected (1)' }));
    const busy = await screen.findByRole('button', { name: 'Deleting 0 / 1…' });
    expect(busy).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Select media-1.png' })).toBeDisabled();
    fireEvent.click(busy);
    expect(mediaService.delete).toHaveBeenCalledOnce();
    await act(async () => finish({}));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete selected (0)' })).toBeDisabled());
  });

});
