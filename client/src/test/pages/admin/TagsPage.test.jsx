import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TagsPage from '../../../pages/admin/TagsPage';
import { getTags, createTag, renameTag, deleteTag } from '../../../services/tagService';
const permissions = vi.hoisted(() => new Set());
const notify = vi.hoisted(() => vi.fn());
vi.mock('../../../services/tagService', () => ({ getTags: vi.fn(), createTag: vi.fn(), renameTag: vi.fn(), deleteTag: vi.fn() }));
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
    await waitFor(() => expect(createTag).toHaveBeenCalledWith('Home Gardening', ''));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Tag created.', 'success'));
  });
  it('renames the shared label using its existing id', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Summer' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Edit tag' }));
    fireEvent.change(dialog.getByRole('textbox', { name: /Tag name/ }), { target: { value: 'Warm Season' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save tag' }));
    await waitFor(() => expect(renameTag).toHaveBeenCalledWith('tag-1', 'Warm Season', ''));
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
    expect(dialog.getByRole('textbox', { name: 'Description' })).toHaveValue('Original introduction');
    fireEvent.change(dialog.getByRole('textbox', { name: 'Description' }), { target: { value: '  Products for warm weather.  ' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save tag' }));
    await waitFor(() => expect(renameTag).toHaveBeenCalledWith('tag-1', 'Summer', 'Products for warm weather.'));
  });

});
