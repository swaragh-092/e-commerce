import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    delete: vi.fn(),
    update: vi.fn(),
  },
}));

describe('Media Library tabs', () => {
  let observers;

  beforeEach(() => {
    vi.clearAllMocks();
    observers = [];
    mediaService.list.mockResolvedValue({
      data: [{ id: 'media-1', url: '/media-1.png', originalName: 'media-1.png', size: 1024 }],
      meta: { totalItems: 2, page: 1, totalPages: 2 },
    });

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
    expect(restoredSentinel).not.toBe(firstSentinel);
    expect(observers[1].observe).toHaveBeenCalledWith(restoredSentinel);
  });
});
