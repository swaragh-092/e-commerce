import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GalleryPage from '../../../pages/admin/GalleryPage';
import { galleryService } from '../../../services/galleryService';

const { notify, confirm } = vi.hoisted(() => ({ notify: vi.fn(), confirm: vi.fn().mockResolvedValue(true) }));

vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify, confirm }) }));
vi.mock('../../../components/common/MediaPicker', () => ({
  default: ({ open, onSelect }) => open ? <button onClick={() => onSelect([{ id: 'media-2', mimeType: 'image/png', url: '/two.png' }, { id: 'media-2', mimeType: 'image/png', url: '/two.png' }])}>Pick image</button> : null,
}));
vi.mock('../../../services/galleryService', () => ({ galleryService: {
  list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(),
  addImages: vi.fn(), removeImage: vi.fn(), reorder: vi.fn(),
} }));

const first = { id: 'item-1', mediaId: 'media-1', priority: 0, media: { url: '/one.png', originalName: 'One' } };
const second = { id: 'item-2', mediaId: 'media-2', priority: 1, media: { url: '/two.png', originalName: 'Two' } };
const album = { id: 'gallery-1', title: 'Flowers', slug: 'flowers', description: '', isActive: true, items: [first] };

describe('Catalog Gallery page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    galleryService.list.mockResolvedValue({ data: [album], meta: { totalPages: 1 } });
    galleryService.create.mockResolvedValue({ data: { ...album, id: 'gallery-2', title: 'Seed Trials', slug: 'seed-trials', items: [] } });
    galleryService.addImages.mockResolvedValue({ data: { ...album, items: [first, second] } });
    galleryService.reorder.mockResolvedValue({ data: { ...album, items: [second, first] } });
  });

  it('shows albums separately and adds selected media images', async () => {
    render(<GalleryPage />);
    expect(await screen.findByText('Public URL: /demo-orbis-seeds-v1-html/gallery.html?album=flowers')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add images' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick image' }));
    await waitFor(() => expect(galleryService.addImages).toHaveBeenCalledWith('gallery-1', ['media-2']));
    expect(await screen.findByText('Two')).toBeInTheDocument();
  });

  it('creates an album with a URL slug from its name', async () => {
    render(<GalleryPage />);
    await screen.findByText('Public URL: /demo-orbis-seeds-v1-html/gallery.html?album=flowers');
    fireEvent.click(screen.getByRole('button', { name: 'New gallery' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Gallery name/ }), { target: { value: 'Seed Trials' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create gallery' }));
    await waitFor(() => expect(galleryService.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Seed Trials', slug: 'seed-trials', isActive: true })));
  });

  it('saves a changed image order', async () => {
    galleryService.list.mockResolvedValue({ data: [{ ...album, items: [first, second] }], meta: { totalPages: 1 } });
    render(<GalleryPage />);
    await screen.findByText('Two');
    fireEvent.click(screen.getByRole('button', { name: 'Move image 1 down' }));
    await waitFor(() => expect(galleryService.reorder).toHaveBeenCalledWith('gallery-1', ['item-2', 'item-1']));
  });
});
