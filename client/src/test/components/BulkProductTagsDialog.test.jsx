import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BulkProductTagsDialog from '../../components/admin/BulkProductTagsDialog';
import { bulkUpdateProductTags, getTags } from '../../services/tagService';
vi.mock('../../services/tagService', () => ({ bulkUpdateProductTags: vi.fn(), getTags: vi.fn() }));
const selected = ['product-a', 'product-b'];
const mount = (props = {}) => render(<BulkProductTagsDialog productIds={selected} onClose={vi.fn()} onSaved={vi.fn()} {...props} />);
const typeTag = (name) => {
  const input = screen.getByRole('combobox', { name: 'Tags' });
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: 'Enter' });
};
beforeEach(() => {
  vi.clearAllMocks();
  getTags.mockResolvedValue({ data: [{ name: 'Summer' }] });
  bulkUpdateProductTags.mockResolvedValue({ data: { updatedCount: 2, selectedCount: 2, changedCount: 2 } });
});

describe('bulk product tags dialog', () => {
  it('adds labels to a snapshot of the selected products', async () => {
    const onSaved = vi.fn(); mount({ onSaved });
    typeTag('Beginner Friendly');
    fireEvent.click(screen.getByRole('button', { name: 'Apply tags' }));
    await waitFor(() => expect(bulkUpdateProductTags).toHaveBeenCalledWith({ productIds: selected, action: 'add', tags: ['Beginner Friendly'] }));
    expect(onSaved).toHaveBeenCalledWith({ updatedCount: 2, selectedCount: 2, changedCount: 2 }, 'add');
  });
  it('removes existing labels and clears add-mode entries when switching action', async () => {
    mount(); typeTag('New label');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Action' }));
    fireEvent.click(screen.getByRole('option', { name: 'Remove tags' }));
    expect(screen.queryByText('New label', { exact: true })).not.toBeInTheDocument();
    const input = screen.getByRole('combobox', { name: 'Tags' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Sum' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Summer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply tags' }));
    await waitFor(() => expect(bulkUpdateProductTags).toHaveBeenCalledWith({ productIds: selected, action: 'remove', tags: ['Summer'] }));
  });
  it('requires at least one label before submitting', async () => {
    mount(); fireEvent.click(screen.getByRole('button', { name: 'Apply tags' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose 1–50 tags');
    expect(bulkUpdateProductTags).not.toHaveBeenCalled();
  });
  it('keeps the dialog, selection and tags available after an API failure', async () => {
    const onSaved = vi.fn();
    bulkUpdateProductTags.mockRejectedValueOnce({ response: { data: { error: { message: 'A selected product exceeds the limit.' } } } });
    mount({ onSaved }); typeTag('Summer');
    fireEvent.click(screen.getByRole('button', { name: 'Apply tags' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('exceeds the limit');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Summer', { exact: true })).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply tags' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(bulkUpdateProductTags).toHaveBeenLastCalledWith({ productIds: selected, action: 'add', tags: ['Summer'] });
  });
  it('blocks repeated submissions and cancellation while saving', async () => {
    let complete;
    bulkUpdateProductTags.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const onClose = vi.fn(); const onSaved = vi.fn(); mount({ onClose, onSaved }); typeTag('Summer');
    fireEvent.click(screen.getByRole('button', { name: 'Apply tags' }));
    expect(screen.getByRole('button', { name: 'Applying…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Applying…' }));
    expect(bulkUpdateProductTags).toHaveBeenCalledOnce();
    complete({ data: { updatedCount: 2, selectedCount: 2, changedCount: 2 } });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });
});
