import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TagsPage from '../../../pages/admin/TagsPage';
import { getTags, createTag, renameTag, deleteTag } from '../../../services/tagService';
const permissions = vi.hoisted(() => new Set());
const notify = vi.hoisted(() => vi.fn());
vi.mock('../../../services/tagService', () => ({ getTags: vi.fn(), createTag: vi.fn(), renameTag: vi.fn(), deleteTag: vi.fn() }));
vi.mock('../../../components/common/MediaPicker', async () => {
  const { Dialog } = await import('@mui/material');
  return { default: ({ onSelect }) => <Dialog open><button onClick={() => onSelect([{ id: 'image-1', url: '/uploads/tag.jpg' }])}>Choose test image</button></Dialog> };
});
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: (permission) => permissions.has(permission) }) }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify }) }));
const tag = { id: 'tag-1', name: 'Summer', slug: 'summer', productCount: 4 };
const mount = () => render(<MemoryRouter><TagsPage /></MemoryRouter>);
beforeEach(() => {
  vi.clearAllMocks(); permissions.clear();
  ['products.read', 'products.create', 'products.update', 'products.delete'].forEach((permission) => permissions.add(permission));
  getTags.mockResolvedValue({ data: [tag], meta: { total: 1 } });
  createTag.mockResolvedValue({}); renameTag.mockResolvedValue({}); deleteTag.mockResolvedValue({});
});

describe('tag management', () => {
  it('shows product counts and links to filtered admin products', async () => {
    mount();
    expect(await screen.findByRole('link', { name: 'View products tagged Summer' })).toHaveAttribute('href', '/admin/products?tags=summer');
    expect(screen.getByText('summer', { exact: true })).toBeInTheDocument();
  });
  it('creates a tag and refreshes the dictionary', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Add tag' }));
    fireEvent.change(dialog.getByRole('textbox', { name: /Tag name/ }), { target: { value: ' Home   Gardening ' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save tag' }));
    await waitFor(() => expect(createTag).toHaveBeenCalledWith('Home Gardening', '', null));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Tag created.', 'success'));
  });
  it('renames the shared label using its existing id', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Summer' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Edit tag' }));
    fireEvent.change(dialog.getByRole('textbox', { name: /Tag name/ }), { target: { value: 'Warm Season' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(renameTag).toHaveBeenCalledWith('tag-1', 'Warm Season', '', null));
  });
  it('explains deletion, supports cancellation, and deletes only after confirmation', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Summer' }));
    let dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText(/products will remain/)).toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(deleteTag).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete Summer' }));
    dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Delete tag' }));
    await waitFor(() => expect(deleteTag).toHaveBeenCalledWith('tag-1'));
  });
  it('keeps the form open on duplicate names', async () => {
    createTag.mockRejectedValue({ response: { data: { error: { message: 'A tag with this name already exists.' } } } });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByRole('textbox', { name: /Tag name/ }), { target: { value: 'Summer' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save tag' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('already exists');
    expect(dialog.getByRole('button', { name: 'Save tag' })).toBeEnabled();
  });
  it('provides read-only controls for a product reader', async () => {
    permissions.clear(); permissions.add('products.read'); mount();
    await screen.findByText('Summer', { exact: true });
    expect(screen.queryByRole('button', { name: 'Add tag' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Summer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Summer' })).not.toBeInTheDocument();
  });
  it('shows a retry action for load failures', async () => {
    getTags.mockRejectedValueOnce(new Error('Offline')); mount();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Summer', { exact: true })).toBeInTheDocument();
  });
  it('loads and updates the storefront description without changing the tag name', async () => {
    getTags.mockResolvedValue({ data: [{ ...tag, description: 'Original introduction' }], meta: { total: 1 } });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Summer' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Edit tag' }));
    expect(dialog.getByRole('textbox', { name: 'Description (optional)' })).toHaveValue('Original introduction');
    fireEvent.change(dialog.getByRole('textbox', { name: 'Description (optional)' }), { target: { value: '  Products for warm weather.  ' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(renameTag).toHaveBeenCalledWith('tag-1', 'Summer', 'Products for warm weather.', null));
  });

  it('keeps the storefront URL stable while renaming and protects unsaved edits', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Summer' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Edit tag' }));
    expect(dialog.getByRole('link', { name: 'View page' })).toHaveAttribute('href', expect.stringContaining('/tags/summer'));
    expect(dialog.getByText('Used by 4 products.')).toBeInTheDocument();
    fireEvent.change(dialog.getByRole('textbox', { name: /Tag name/ }), { target: { value: 'Warm Season' } });
    expect(dialog.getByRole('link', { name: 'View page' })).toHaveAttribute('href', expect.stringContaining('/tags/summer'));
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeInTheDocument());
    expect(dialog.getByRole('textbox', { name: /Tag name/ })).toHaveValue('Warm Season');
    fireEvent.click(dialog.getByRole('button', { name: 'Close tag editor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(renameTag).not.toHaveBeenCalled();
  });
  it('applies usage and sorting on the server', async () => {
    mount();
    await screen.findByText('Summer', { exact: true });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Usage' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Unused tags' }));
    await waitFor(() => expect(getTags).toHaveBeenLastCalledWith(expect.objectContaining({ usage: 'unused', page: 1 })));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Sort by' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Most products' }));
    await waitFor(() => expect(getTags).toHaveBeenLastCalledWith(expect.objectContaining({ usage: 'unused', sortBy: 'products', sortDir: 'desc' })));
  });
  it('provides a full selectable link if clipboard copy fails', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
    try {
      mount();
      fireEvent.click(await screen.findByRole('button', { name: 'Copy storefront link for Summer' }));
      const dialog = within(await screen.findByRole('dialog', { name: 'Copy storefront link' }));
      expect(dialog.getByRole('textbox', { name: 'Storefront URL' }).value).toMatch(/^https?:.*\/tags\/summer$/);
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original); else delete navigator.clipboard;
    }
  });

  it('selects and saves a tag image, and allows explicitly removing it', async () => {
    permissions.add('media.read');
    const view = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Summer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose test image' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Choose test image' })).not.toBeInTheDocument());
    expect(screen.getByRole('img', { name: 'Selected tag image' })).toHaveAttribute('src', '/uploads/tag.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(renameTag).toHaveBeenCalledWith('tag-1', 'Summer', '', 'image-1'));
    view.unmount();
    getTags.mockResolvedValue({ data: [{ ...tag, imageId: 'image-1', image: { id: 'image-1', url: '/uploads/tag.jpg' } }], meta: { total: 1 } });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Summer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    expect(screen.queryByRole('img', { name: 'Selected tag image' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(renameTag).toHaveBeenLastCalledWith('tag-1', 'Summer', '', null));
  });

});
