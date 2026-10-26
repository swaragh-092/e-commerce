import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MediaPage from '../../../pages/admin/MediaPage';
import { mediaService } from '../../../services/mediaService';

const { notify, confirm } = vi.hoisted(() => ({
  notify: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }));
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
    observers = [];
    mediaService.listIcons.mockResolvedValue({ data: [] });
    mediaService.list.mockImplementation(({ page }) => Promise.resolve({
      data: [{ id: `media-${page}`, url: `/media-${page}.png`, originalName: `media-${page}.png`, size: 1024 }],
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

  it('renders custom icons and displays upload button in icon library', async () => {
    mediaService.listIcons.mockResolvedValue({
      data: [{ id: 'custom-icon-1', url: '/uploads/custom-brand.png', originalName: 'custom-brand.png' }],
    });

    render(<MediaPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Icon library' }));

    expect(await screen.findByText('Upload Custom Icon')).toBeInTheDocument();
    expect(await screen.findByText('custom-brand.png')).toBeInTheDocument();
  });
});
